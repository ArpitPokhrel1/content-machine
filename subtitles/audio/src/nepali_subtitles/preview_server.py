"""Loopback-only static preview server with audio byte-range support."""
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range=None
        if any(part.startswith('.') for part in Path(unquote(urlsplit(self.path).path)).parts):
            self.send_error(403);return None
        path=Path(self.translate_path(self.path))
        if path.is_file() and self.headers.get('Range'):
            size=path.stat().st_size
            match=re.fullmatch(r'bytes=(\d*)-(\d*)',self.headers['Range'])
            if not match or not any(match.groups()):self.send_error(416);return None
            left,right=match.groups()
            start=int(left) if left else max(0,size-int(right));end=min(size-1,int(right)) if right and left else size-1
            if start>=size or start>end:
                self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
            stream=path.open('rb');stream.seek(start);self.byte_range=(start,end)
            self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Content-Length',str(end-start+1));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Accept-Ranges','bytes');self.end_headers();return stream
        return super().send_head()

    def copyfile(self,source,outputfile):
        if self.byte_range:
            remaining=self.byte_range[1]-self.byte_range[0]+1
            while remaining>0:
                chunk=source.read(min(65536,remaining))
                if not chunk:break
                outputfile.write(chunk);remaining-=len(chunk)
        else:super().copyfile(source,outputfile)


def serve(directory,port=8766):
    from functools import partial
    server=ThreadingHTTPServer(('127.0.0.1',port),partial(PreviewHandler,directory=str(Path(directory).resolve())))
    print(f'Preview: http://127.0.0.1:{port}/subtitles.html',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
