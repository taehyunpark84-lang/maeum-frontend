"""기존/신규 작품 모두 조회 시 미리보기를 만듭니다. 원본은 절대 변경하지 않습니다."""
import hashlib
import os
import tempfile
from pathlib import Path
from PIL import Image, ImageOps


def thumbnail_for(original: Path, directory: Path) -> Path:
    stat = original.stat()
    # 원본 교체 또는 미리보기 규격 변경 시 이전 파일을 재사용하지 않습니다.
    identity = f'v1:{original.name}:{stat.st_size}:{stat.st_mtime_ns}'
    name = hashlib.sha256(identity.encode()).hexdigest() + '.jpg'
    target = directory / name
    if target.is_file():
        return target
    directory.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with Image.open(original) as source:
            picture = ImageOps.exif_transpose(source).convert('RGBA')
            picture.thumbnail((512, 768), Image.Resampling.LANCZOS)
            background = Image.new('RGB', picture.size, 'white')
            background.paste(picture, mask=picture.getchannel('A'))
            with tempfile.NamedTemporaryFile(dir=directory, suffix='.tmp', delete=False) as file:
                temporary = Path(file.name)
            background.save(temporary, format='JPEG', quality=82, optimize=True)
        # 동시 요청에도 완성된 파일만 노출합니다.
        try:
            os.replace(temporary, target)
        except PermissionError:
            # Windows에서 다른 요청이 먼저 만든 파일을 읽고 있으면 교체가 거절될 수 있습니다.
            # 파일명은 원본 버전에 묶여 있으므로 이미 완성된 동일 미리보기를 사용합니다.
            if not target.is_file():
                raise
        return target
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
