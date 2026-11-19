import io
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from app.thumbnails import thumbnail_for
from app.db import Db, Diary
from app.config import DATA
from test_shared_history import person, enter, completed_work
from test_flow import client


def test_existing_and_new_images_preserve_original_and_reuse(tmp_path):
    for size in [(1024,1536),(300,100),(100,200)]:
        original = tmp_path / f'{size[0]}.png'
        Image.new('RGBA', size, (20,80,150,180)).save(original)
        before = original.read_bytes()
        with ThreadPoolExecutor(3) as pool:
            paths = list(pool.map(lambda _: thumbnail_for(original, tmp_path/'thumbs'), range(3)))
        assert len(set(paths)) == 1
        target = paths[0]
        modified = target.stat().st_mtime_ns
        assert thumbnail_for(original, tmp_path/'thumbs').stat().st_mtime_ns == modified
        with Image.open(target) as image:
            assert image.width <= 512 and image.height <= 768
            assert abs(image.width/image.height - size[0]/size[1]) < .01
        assert original.read_bytes() == before
        Image.new('RGB', size, 'red').save(original)
        assert thumbnail_for(original, tmp_path/'thumbs') != target


def test_authorization_fallback_and_original_download(person, monkeypatch):
    import app.main as main
    sid = enter('forest')
    diary_id = completed_work(person, sid)
    with Db() as db:
        row = db.get(Diary, diary_id)
        row.image_file = diary_id+'.png'
        db.commit()
    original = DATA/'images'/row.image_file
    original.parent.mkdir(exist_ok=True)
    Image.new('RGB',(1024,1536),'gold').save(original)
    before = original.read_bytes()
    url = f'/diaries/{diary_id}'
    response = client.get(url+'/thumbnail')
    assert response.status_code == 200
    assert response.headers['content-type'] == 'image/jpeg'
    assert Image.open(io.BytesIO(response.content)).size == (512,768)
    assert client.get(url+'/image').content == before
    main.app.dependency_overrides[main.current_user] = lambda: 'other-user'
    assert client.get(url+'/thumbnail').status_code == 404
    main.app.dependency_overrides.clear()
    assert client.get(url+'/thumbnail').status_code == 401
    main.app.dependency_overrides[main.current_user] = lambda: person
    def fail(*args):
        raise OSError('storage unavailable')
    monkeypatch.setattr(main,'thumbnail_for',fail)
    assert client.get(url+'/thumbnail').content == before
    original.unlink()
    assert client.get(url+'/thumbnail').status_code == 404
