import io
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, correlate, find_peaks
from math import gcd


def load_audio(path, rate=16000):
    y, sr = sf.read(path, dtype="float32", always_2d=True)
    y = y.mean(axis=1)
    if sr != rate:
        g = gcd(sr, rate)
        y = resample_poly(y, rate//g, sr//g).astype(np.float32)
    return y, rate


def wav_bytes(y, sr):
    b = io.BytesIO()
    sf.write(b, y, sr, format="WAV", subtype="PCM_16")
    return b.getvalue()


def analyse(y, sr):
    """10ms RMS and autocorrelation pitch; descriptive cues, not emotion labels."""
    hop = int(sr*.01)
    frame = int(sr*.04)
    rms, pitch, times = [], [], []
    for i in range(0, max(1,len(y)-frame+1), hop):
        x = y[i:i+frame].astype(float)
        energy = float(np.sqrt(np.mean(x*x)+1e-12))
        rms.append(energy); times.append(i/sr)
        x = (x-x.mean())*np.hanning(len(x))
        ac = correlate(x,x,mode="full",method="fft")[len(x)-1:]
        lo,hi = int(sr/420), min(len(ac)-1,int(sr/65))
        peaks,_ = find_peaks(ac[lo:hi])
        f0 = None
        if len(peaks) and ac[0]>1e-8:
            lag = int(peaks[np.argmax(ac[lo+peaks])]+lo)
            if ac[lag]/ac[0]>.55 and energy>.007:
                f0 = float(sr/lag)
        pitch.append(f0)
    rms=np.array(rms); times=np.array(times)
    threshold=max(.0025,min(.018,float(np.percentile(rms,15))*2.0))
    quiet=rms<threshold
    pauses=[]; start=None
    for i,flag in enumerate(list(quiet)+[False]):
        if flag and start is None: start=i
        if not flag and start is not None:
            if (i-start)*.01>=.16:
                pauses.append({'start':round(float(times[start]),3),'end':round(min(len(y)/sr,i*.01+.02),3)})
            start=None
    return {'duration':len(y)/sr,'sample_rate':sr,'frame_hop_seconds':.01,'silence_rms_threshold':threshold,
            'times':times.tolist(),'rms':rms.tolist(),'pitch_hz':pitch,'pauses':pauses,
            'method':'RMS + normalized autocorrelation; pause/energy/pitch proxies, not validated emotion classification'}


def chunks(y,sr,features,target=20):
    """Cut near a pause within 3s of target, bounded to 25s; no missing samples."""
    boundaries=[0.0]; duration=len(y)/sr
    while duration-boundaries[-1]>target+3:
        ideal=boundaries[-1]+target
        candidates=[(p['start']+p['end'])/2 for p in features['pauses'] if abs((p['start']+p['end'])/2-ideal)<=3]
        boundaries.append(min(candidates,key=lambda v:abs(v-ideal)) if candidates else ideal)
    boundaries.append(duration)
    return [(a,b,wav_bytes(y[round(a*sr):round(b*sr)],sr)) for a,b in zip(boundaries,boundaries[1:])]


def audible_onset(start, limit, features):
    """Move only quiet lead-ins forward; require 30ms sustained activity.

    RMS frames look 40ms ahead, so use the frame center plus a small guard.
    This is a conservative acoustic refinement, not a phoneme recognizer.
    """
    times=np.asarray(features['times']);energy=np.asarray(features['rms'])
    gate=max(.004,min(.016,float(np.percentile(energy,90))*.05))
    index=int(np.searchsorted(times,start))
    if index>=len(times):return start
    # Don't move a boundary already inside active speech.
    if np.max(energy[index:min(index+3,len(energy))])>=gate:return start
    stop=int(np.searchsorted(times,min(limit,start+1.2)))
    for k in range(index,max(index,stop-2)):
        if np.all(energy[k:k+3]>=gate):
            return min(limit,max(start,float(times[k])+.03))
    return start
