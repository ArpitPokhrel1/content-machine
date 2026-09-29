"""Authenticated Cloudflare adapters; requests are cached and costs are auditable."""
import asyncio
import base64
import hashlib
import json
import os
import ssl
import time
from datetime import datetime, timezone
from pathlib import Path
import certifi
import httpx
import numpy as np
import websockets
from .auth import credentials
from .audio import chunks

MODELS={
 'whisper':{'id':'@cf/openai/whisper','usd_per_minute':.000453,'language_control':False},
 'whisper-large-v3-turbo':{'id':'@cf/openai/whisper-large-v3-turbo','usd_per_minute':.000513,'language_control':True},
 'whisper-tiny-en':{'id':'@cf/openai/whisper-tiny-en','usd_per_minute':None,'language_control':False,'note':'English only; no current unit price published'},
 'nova-3':{'id':'@cf/deepgram/nova-3','usd_per_minute':.0052,'language_control':True},
 'flux':{'id':'@cf/deepgram/flux','usd_per_minute':.0077,'language_control':False,'note':'WebSocket only; Cloudflare schema exposes no language selector'},
}


def headers(token):
    out={'Authorization':'Bearer '+token}
    gateway=os.getenv('CLOUDFLARE_AI_GATEWAY_ID')
    if gateway:out['cf-aig-gateway-id']=gateway
    return out


def discover():
    account,token=credentials()
    r=httpx.get(f'https://api.cloudflare.com/client/v4/accounts/{account}/ai/models/search',headers=headers(token),params={'task':'dfce1c48-2a81-462e-a7fd-de97ce985207'},timeout=30)
    r.raise_for_status()
    return r.json()


def transcribe(name,audio,start,duration,cache_dir,prompt='',language='ne',refresh=False):
    if name not in MODELS or name=='flux':raise ValueError('Use a supported file-based model')
    model=MODELS[name]['id'];params={}
    if name=='whisper-large-v3-turbo':
        params={'language':language,'task':'transcribe','vad_filter':False,'condition_on_previous_text':True}
        if prompt:params['initial_prompt']=prompt
    elif name=='nova-3':params={'language':language,'punctuate':'true','smart_format':'true'}
    key=hashlib.sha256(audio+json.dumps([model,params,start],sort_keys=True).encode()).hexdigest()[:20]
    path=Path(cache_dir)/f'{name}-{key}.json';path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and not refresh:return {**json.loads(path.read_text()),'cache_hit':True}
    account,token=credentials();h=headers(token);url=f'https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}'
    if name=='whisper-large-v3-turbo':kwargs={'json':{'audio':base64.b64encode(audio).decode(),**params}}
    else:h['Content-Type']='audio/wav';kwargs={'content':audio,'params':params}
    began=time.monotonic()
    try:
        r=httpx.post(url,headers=h,timeout=240,**kwargs)
        try:response=r.json()
        except ValueError:response={'errors':[{'message':r.text[:1000]}]}
        result={'http_status':r.status_code,'response':response,'cf_ray':r.headers.get('cf-ray')}
    except httpx.HTTPError as e:
        # No automatic retry of a POST: the server may have billed a timed-out call.
        result={'http_status':None,'error':type(e).__name__,'response':{}}
    result.update(model=model,offset=start,audio_seconds=duration,elapsed_seconds=round(time.monotonic()-began,3),
                  request_parameters=params,audio_sha256=hashlib.sha256(audio).hexdigest(),created_at=datetime.now(timezone.utc).isoformat())
    rate=MODELS[name]['usd_per_minute']
    result['list_price_estimate_usd']=duration/60*rate if rate is not None else None
    result['billing_note']='List estimate, not invoice. Errors/timeouts may have unknown billing; included neurons may cover usage.'
    result['cache_hit']=False
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return result


async def stream_flux(y,sr,cache_dir,refresh=False):
    raw=(np.clip(y,-1,1)*32767).astype('<i2').tobytes()
    key=hashlib.sha256(raw).hexdigest()[:20];path=Path(cache_dir)/f'flux-{key}.json';path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and not refresh:return {**json.loads(path.read_text()),'cache_hit':True}
    account,token=credentials();events=[];sent=0;began=time.monotonic();error=None;status=None
    uri=f'wss://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/deepgram/flux?encoding=linear16&sample_rate={sr}'
    try:
        async with websockets.connect(uri,additional_headers=headers(token),ssl=ssl.create_default_context(cafile=certifi.where()),open_timeout=30,max_size=10_000_000) as ws:
            status=101
            async def receive():
                async for message in ws:events.append(json.loads(message))
            receiving=asyncio.create_task(receive())
            for pos in range(0,len(raw),sr//10*2):
                frame=raw[pos:pos+sr//10*2];await ws.send(frame);sent+=len(frame)/(sr*2);await asyncio.sleep(.1)
            await ws.send(bytes(sr*2*2));sent+=2;await asyncio.sleep(3);await ws.close();await receiving
    except Exception as exc:
        error=type(exc).__name__+': '+str(exc);status=getattr(getattr(exc,'response',None),'status_code',status)
    result={'model':'@cf/deepgram/flux','http_status':status,'audio_seconds':sent,'error':error,'events':events,'elapsed_seconds':time.monotonic()-began,
            'list_price_estimate_usd':sent/60*.0077,'created_at':datetime.now(timezone.utc).isoformat()}
    result['cache_hit']=False
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');return result


def benchmark(y,sr,features,directory,names=None,prompt='',refresh=False):
    results=[]
    for name in names or list(MODELS):
        if name=='flux':results.append(asyncio.run(stream_flux(y,sr,directory,refresh)));continue
        for start,end,audio in chunks(y,sr,features):
            result=transcribe(name,audio,start,end-start,directory,prompt,refresh=refresh);results.append(result)
            print(f'{name}: {start:.2f}–{end:.2f}s HTTP {result["http_status"]}',flush=True)
            if result['http_status'] in (400,401,403):break
    return results
