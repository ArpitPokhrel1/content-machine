"""Configurable subtitle grouping and plain SRT / styled ASS / legacy Preeti export."""
import json
import re
from pathlib import Path
import numpy as np
from .alignment import graphemes,normalized
from .audio import audible_onset

PRESETS={
 'portrait':{'max_words':5,'max_graphemes':28,'max_seconds':2.8,'target_seconds':1.8,'pause_break':.22,'font':'Noto Sans Devanagari','font_size':60,'width':1080,'height':1920,'margin_v':350,'margin_l':96,'margin_r':140},
 'narrative':{'max_words':9,'max_graphemes':48,'max_seconds':4.5,'target_seconds':2.6,'pause_break':.28,'font':'Kohinoor Devanagari','font_size':56},
 'shorts':{'max_words':5,'max_graphemes':27,'max_seconds':2.7,'target_seconds':1.7,'pause_break':.20,'font':'Kohinoor Devanagari','font_size':68},
 'calm':{'max_words':13,'max_graphemes':64,'max_seconds':6,'target_seconds':3.8,'pause_break':.42,'font':'Devanagari Sangam MN','font_size':52},
 'word':{'max_words':1,'max_graphemes':30,'max_seconds':2,'target_seconds':.4,'pause_break':.1,'font':'Kohinoor Devanagari','font_size':68},
}


def wrap(text,limit=26):
    words=text.split()
    if graphemes(text)<=limit or len(words)<2:return text
    candidates=[]
    for i in range(1,len(words)):
        a,b=' '.join(words[:i]),' '.join(words[i:])
        # Balance visual width; keep punctuation naturally at the end of the first line.
        score=max(graphemes(a),graphemes(b))+abs(graphemes(a)-graphemes(b))*.2
        if (normalized(words[i-1])=='सोह्र' and normalized(words[i]).startswith('श्राद्ध')) or (normalized(words[i-1]),normalized(words[i]))==('पितृ','पक्ष'):score+=20
        if re.search('[,;।?!]$',a):score-=3
        candidates.append((score,a+'\n'+b))
    return min(candidates)[1]


def strategy_config(preset,overrides=None):
    overrides=overrides or {}
    base=overrides.get('base',preset if preset in PRESETS else 'narrative')
    if base not in PRESETS:raise ValueError(f'Unknown base strategy: {base}')
    if preset not in PRESETS and not overrides:raise ValueError(f'Unknown strategy: {preset}')
    cfg={**PRESETS[base],**overrides,'base':base}
    for key in ['max_words','max_graphemes','max_seconds','target_seconds','pause_break','font_size']:
        if not isinstance(cfg[key],(int,float)) or not np.isfinite(cfg[key]) or cfg[key]<=0:raise ValueError(f'{key} must be positive and finite')
    if not isinstance(cfg['max_words'],int):raise ValueError('max_words must be an integer')
    if cfg['target_seconds']>cfg['max_seconds']:raise ValueError('target_seconds cannot exceed max_seconds')
    return cfg


def make_cues(words,features,preset='narrative',overrides=None):
    cfg=strategy_config(preset,overrides);duration=features['duration'];pauses=features['pauses']
    word_mode=cfg['base']=='word'
    # Dynamic programming chooses phrase boundaries globally rather than greedily
    # filling each cue and leaving a one-word fragment at the sentence end.
    frame_times=np.array(features['times']);frame_rms=np.array(features['rms'])
    count=len(words);cost=[float('inf')]*(count+1);previous=[None]*(count+1);cost[0]=0
    bad_ends={'र','तर','का','को','कि','त','नै','अर्थात्'}
    no_breaks=set();norms=[normalized(w['text']) for w in words]
    if not word_mode:
        for phrase in cfg.get('protected_phrases',['सोह्र श्राद्ध','पितृ पक्ष','अन्न दान','प्राप्त गरी','का लागि','सुन्नका लागि']):
            pattern=[normalized(w) for w in phrase.split()]
            for i in range(len(norms)-len(pattern)+1):
                if norms[i:i+len(pattern)]==pattern:no_breaks.update(range(i+1,i+len(pattern)))
    hard_breaks={i+1 for i,w in enumerate(words) if re.search('[।?!;]$',w['text'])}
    if words and words[0].get('line_end'):hard_breaks.add(1)
    for i,w in enumerate(words):
        if w.get('line_end') and i<3:hard_breaks.add(i+1)
    for i in range(count):
        for j in range(i+1,min(count,i+cfg['max_words'])+1):
            g=words[i:j];text=' '.join(w['text'] for w in g);length=graphemes(text);dur=g[-1]['end']-g[0]['start']
            if j>i+1 and (length>cfg['max_graphemes'] or dur>cfg['max_seconds']):break
            if any(i<k<j for k in hard_breaks):break
            if j in no_breaks:continue
            boundary=0
            if j<count:
                gap=words[j]['start']-g[-1]['end']
                pause=max([p['end']-p['start'] for p in pauses if g[-1]['end']-.12<=p['start'] and p['end']<=words[j]['start']+.12] or [0])
                boundary=gap+pause
                # A vocal reset after a small pause is a useful phrase boundary.
                pivot=(words[j]['start']+g[-1]['end'])/2
                before=(frame_times>=pivot-.24)&(frame_times<pivot)
                after=(frame_times>=pivot)&(frame_times<pivot+.24)
                b=float(np.mean(frame_rms[before])) if before.any() else 0
                a=float(np.mean(frame_rms[after])) if after.any() else 0
                boundary+=min(.12,abs(a-b)/max(.01,a+b)*.12) if gap>.06 else 0
                pbefore=[features['pitch_hz'][k] for k in np.flatnonzero(before) if features['pitch_hz'][k] is not None]
                pafter=[features['pitch_hz'][k] for k in np.flatnonzero(after) if features['pitch_hz'][k] is not None]
                if pbefore and pafter and gap>.06:
                    semitones=abs(12*np.log2(np.median(pafter)/np.median(pbefore)))
                    boundary+=min(.08,semitones/12*.08)
            natural=j in hard_breaks or g[-1].get('line_end') or boundary>=cfg['pause_break']
            candidate=(dur-cfg['target_seconds'])**2*.45+1.5
            if natural:candidate-=1.5
            if j<count and g[-1]['text'].strip("'’") in bad_ends:candidate+=4
            if j<count and normalized(words[j]['text']) in {'लागि','सँग','का','को','मा'}:candidate+=3
            if len(g)==1 and not word_mode:candidate+=4
            if dur<.75 and not word_mode:candidate+=4
            if dur>0 and length/dur>18:candidate+=(length/dur-18)*.3
            # Crossing a supplied line is possible, but usually less readable.
            candidate+=sum(w.get('line_end',False) for w in g[:-1])*1.8
            if cost[i]+candidate<cost[j]:cost[j]=cost[i]+candidate;previous[j]=i
    if previous[count] is None:raise ValueError('No valid subtitle segmentation')
    groups=[];j=count
    while j:
        i=previous[j];groups.append(words[i:j]);j=i
    groups.reverse()
    cues=[];times=np.array(features['times']);rms=np.array(features['rms']);valid=[x for x in features['pitch_hz'] if x is not None];median_pitch=float(np.median(valid)) if valid else 0
    for i,g in enumerate(groups):
        start=max(0,g[0]['start']);spoken_end=min(duration,g[-1]['end']);end=spoken_end
        next_start=groups[i+1][0]['start'] if i+1<len(groups) else duration
        # Keep a readable tail, but never carry text across a long dramatic pause.
        tail=.16 if not word_mode else .03
        end=min(duration,next_start-.035,max(end+tail,start+.65 if not word_mode else start+.10))
        if end<=start:
            end=min(duration,start+.04)
        # Shift leading silence out of an ASR word, without large timing alterations.
        for p in pauses:
            if p['start']<=start+.06<p['end'] and p['end']<min(start+1.0,end-.15):start=p['end']
        original_start=start
        start=audible_onset(start,min(end-.12,g[0]['end']+.12),features)
        text=wrap(' '.join(w['text'] for w in g),cfg['max_graphemes']//2+2)
        sel=(times>=start)&(times<=spoken_end)
        energy=float(np.mean(rms[sel])) if sel.any() else 0
        pitch=[features['pitch_hz'][k] for k in np.flatnonzero(sel) if features['pitch_hz'][k] is not None]
        pmean=float(np.median(pitch)) if pitch else None
        reasons=[]
        if start-original_start>.015:reasons.append('start moved to sustained voice onset')
        if re.search('[।?!]$',g[-1]['text']):reasons.append('sentence ending')
        if next_start-spoken_end>.3:reasons.append('audible pause')
        if energy>float(np.percentile(rms,75)):reasons.append('higher vocal energy')
        if pmean and pmean>median_pitch*1.18:reasons.append('raised pitch')
        if not reasons:reasons.append('phrase/readability limit')
        cues.append({'number':i+1,'unrefined_start':round(original_start,3),'onset_adjustment_ms':round((start-original_start)*1000),'start':round(start,3),'end':round(end,3),'text':text,'word_indices':[w['index'] for w in g],
                     'needs_review':any(w['needs_review'] for w in g),'graphemes_per_second':round(graphemes(text.replace('\n',' '))/max(.01,end-start),2),
                     'rms':round(energy,5),'median_pitch_hz':round(pmean,1) if pmean else None,'reason':reasons})
    return cues


def stamp(t,ass=False):
    scale=100 if ass else 1000;n=round(t*scale);h,n=divmod(n,3600*scale);m,n=divmod(n,60*scale);s,f=divmod(n,scale)
    return f'{h}:{m:02}:{s:02}.{f:02}' if ass else f'{h:02}:{m:02}:{s:02},{f:03}'


def srt(cues):
    return '\n\n'.join(f"{i}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c['text']}" for i,c in enumerate(cues,1))+'\n'


def ass(cues,font='Kohinoor Devanagari',size=56,position='bottom',width=1920,height=1080,margin_v=90,margin_l=120,margin_r=120):
    # Styled sidecar is for ASS-aware renderers. Resolve import target remains SRT.
    alignment={'bottom':2,'center':5,'top':8}[position]
    header=f'''[Script Info]\nTitle: Nepali script-led subtitles\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,{font},{size},&H00FFFFFF,&H0000D7FF,&H00201B17,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,{alignment},{margin_l},{margin_r},{margin_v},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'''
    return header+'\n'.join('Dialogue: 0,'+stamp(c['start'],True)+','+stamp(c['end'],True)+',Default,,0,0,0,,'+c['text'].replace('\\','＼').replace('{','(').replace('}',')').replace('\n','\\N') for c in cues)+'\n'


def preeti_cues(cues):
    import npttf2utf
    mapper=npttf2utf.FontMapper(str(Path(npttf2utf.__file__).parent/'map.json'))
    converted=[];issues=[]
    for c in cues:
        clean=c['text'].replace('\u200d','').replace('\u200c','')
        # The upstream reverse mapper leaves punctuation untouched, which would
        # turn ? into रु and ! into १ in a Preeti font. Map it explicitly.
        clean=re.sub(r"(?<!\S)'",'‘',clean).replace("'",'’')
        punctuation={'?':'<','!':'Û',';':'Ù','‘':'…','’':'Ú','“':'æ','”':'Æ'}
        mapped=''.join(punctuation[x] if x in punctuation else mapper.map_to_preeti(x,from_font='unicode')
                       for x in re.split(r'([?!;‘’“”])',clean) if x)
        back=mapper.map_to_unicode(mapped,from_font='Preeti')
        if clean!=back:issues.append({'cue':c['number'],'original':clean,'roundtrip':back})
        converted.append({**c,'text':mapped})
    return converted,issues


def validate(cues,duration):
    errors=[]
    for i,c in enumerate(cues):
        if not 0<=c['start']<c['end']<=duration+.001:errors.append(f'Cue {i+1}: invalid time range')
        if i and c['start']<cues[i-1]['end']-.001:errors.append(f'Cue {i+1}: overlap')
        if not c['text'].strip():errors.append(f'Cue {i+1}: empty text')
        if len(c['text'].splitlines())>2:errors.append(f'Cue {i+1}: >2 lines')
    return errors
