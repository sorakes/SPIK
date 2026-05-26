from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.worker.celery_app import clone_and_preview_job, process_audio_job, generate_tts_job, generate_preview_job
from app.database import init_db, get_voices, add_voice, delete_voice, get_voice, log_job, get_jobs
from pydantic import BaseModel
import uuid
import os

app = FastAPI(title="SPIK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "/app/data"
os.makedirs(f"{DATA_DIR}/uploads", exist_ok=True)
os.makedirs(f"{DATA_DIR}/outputs", exist_ok=True)

# Serve audio files
app.mount("/audio", StaticFiles(directory=f"{DATA_DIR}/outputs"), name="audio")

@app.on_event("startup")
def startup_event():
    init_db()

class TTSRequest(BaseModel):
    text: str
    voice_id: str
    speed: float = 1.0
    language: str = "pt"

class PreviewRequest(BaseModel):
    voice_id: str
    test_text: str = "Olá, esta é uma demonstração da voz clonada. Como posso te ajudar hoje?"

class VoiceCreate(BaseModel):
    id: str
    name: str
    language: str
    prompt: str
    emotion: str
    file_path: str

@app.post("/api/jobs/clone")
async def create_clone_job(
    file: UploadFile = File(...),
    name: str = Form(...),
    language: str = Form("pt"),
    prompt: str = Form(""),
    emotion: str = Form("Neutro"),
    trim_start: float = Form(0),
    trim_end: float = Form(10),
    test_text: str = Form("Olá! Esta é uma amostra da voz clonada. Como posso te ajudar?"),
):
    job_id = str(uuid.uuid4())
    file_path = f"{DATA_DIR}/uploads/{job_id}_{file.filename}"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    task = clone_and_preview_job.delay(
        file_path, name, job_id, language, prompt, emotion, trim_start, trim_end, test_text
    )
    log_job(task.id, 'CLONE', voice_id=f"clone_{job_id}", voice_name=name, input_text=test_text)
    return {"job_id": task.id, "status": "queued", "voice_id": f"clone_{job_id}"}

@app.post("/api/jobs/tts")
async def create_tts_job(request: TTSRequest):
    task = generate_tts_job.delay(request.text, request.voice_id, request.speed, request.language)
    log_job(task.id, 'TTS', voice_id=request.voice_id, input_text=request.text[:120])
    return {"job_id": task.id, "status": "queued"}

@app.post("/api/jobs/preview")
async def create_preview_job(request: PreviewRequest):
    task = generate_preview_job.delay(request.voice_id, request.test_text)
    log_job(task.id, 'PREVIEW', voice_id=request.voice_id, input_text=request.test_text[:120])
    return {"job_id": task.id, "status": "queued"}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    from app.worker.celery_app import celery_app
    task_result = celery_app.AsyncResult(job_id)
    result = None
    if task_result.status in ("SUCCESS", "FAILURE"):
        try:
            result = task_result.result
        except Exception:
            result = None
    return {
        "job_id": job_id,
        "status": task_result.status,
        "result": result,
    }

@app.get("/api/audit/jobs")
def list_audit_jobs(limit: int = 100):
    return get_jobs(limit)

@app.get("/api/voices")
def list_voices():
    return get_voices()

@app.post("/api/voices")
def create_voice(v: VoiceCreate):
    add_voice(v.id, v.name, v.language, v.prompt, v.emotion, v.file_path)
    return {"ok": True}

@app.delete("/api/voices/{voice_id}")
def remove_voice(voice_id: str):
    delete_voice(voice_id)
    return {"ok": True}

from fastapi import Request
from fastapi.responses import JSONResponse
import asyncio

@app.get("/v1/audio/voices")
def get_openai_compatible_voices():
    voices = get_voices()
    return {"voices": [v["id"] for v in voices]}

@app.get("/v1/voices")
def get_openai_compatible_voices_alt():
    voices = get_voices()
    return {"voices": [v["id"] for v in voices]}

@app.get("/v1/models")
def get_openai_compatible_models():
    models = [
        {"id": "tts-1", "object": "model", "created": 1699053241, "owned_by": "system"},
        {"id": "tts-1-hd", "object": "model", "created": 1699053241, "owned_by": "system"}
    ]
    voices = get_voices()
    for v in voices:
        models.append({
            "id": v["id"],
            "object": "model",
            "created": 1699053241,
            "owned_by": "system"
        })
    return {"object": "list", "data": models}

@app.post("/v1/audio/speech")
async def openai_tts(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    
    text = body.get("input", "")
    model = body.get("model", "")
    voice = body.get("voice", "")
    
    openai_voices = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
    
    voice_id = ""
    if voice and voice not in openai_voices:
        voice_id = voice
    elif model and not model.startswith("tts-"):
        voice_id = model
    else:
        voice_id = voice or model
        
    if not text or not voice_id:
        return JSONResponse({"error": "Missing input or model/voice"}, status_code=400)
    
    from app.worker.celery_app import generate_tts_job, celery_app
    task = generate_tts_job.delay(text, voice_id, 1.0, "pt")
    log_job(task.id, 'API_TTS', voice_id=voice_id, input_text=text[:120])
    
    # Polling síncrono da tarefa (espera até 60 segundos)
    for _ in range(120):
        task_result = celery_app.AsyncResult(task.id)
        if task_result.status == "SUCCESS":
            result = task_result.result
            if result and result.get("output_filename"):
                file_path = f"{DATA_DIR}/outputs/{result['output_filename']}"
                return FileResponse(file_path, media_type="audio/wav")
            break
        elif task_result.status == "FAILURE":
            break
        await asyncio.sleep(0.5)
        
    return JSONResponse({"error": "TTS Generation failed or timeout"}, status_code=500)

# Serve frontend build on / (must be the last route)
FRONTEND_DIR = "/spik/frontend/dist"
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
