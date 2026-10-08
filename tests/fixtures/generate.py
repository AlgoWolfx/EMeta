"""Reproducible synthetic fixtures. Requires Pillow; no personal images are used."""
from pathlib import Path
from PIL import Image, ImageCms, PngImagePlugin
from PIL.TiffImagePlugin import IFDRational
import struct, zlib

root = Path(__file__).parent
image = Image.new('RGB', (64, 48), '#377d60')
for y in range(48):
    for x in range(64): image.putpixel((x, y), ((x * 4) % 256, (y * 5) % 256, ((x + y) * 3) % 256))
icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
def exif(orientation=1):
    e = Image.Exif()
    e[0x010f] = 'Fixture Camera'; e[0x0110] = 'EMeta Synthetic'
    e[0x0112] = orientation; e[0x0131] = 'Fixture Editor'
    e[0x0132] = '2026:01:02 03:04:05'; e[0x013b] = 'Test Creator'
    e[0x8298] = 'Synthetic fixture - MIT'
    e[0x8825] = {1: 'N', 2: (IFDRational(40), IFDRational(42), IFDRational(51)), 3: 'W', 4: (IFDRational(74), IFDRational(0), IFDRational(21))}
    return e
xmp = b'''<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Synthetic Editor"><dc:creator><rdf:Seq><rdf:li>Test Creator</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>'''
def jpeg_marker(code, payload): return b'\xff' + bytes([code]) + struct.pack('>H',len(payload)+2) + payload
def png_chunk(code, payload): return struct.pack('>I',len(payload)) + code + payload + struct.pack('>I',zlib.crc32(code+payload))
def iptc_record(tag, text):
    p=text.encode(); return bytes([0x1c,2,tag])+struct.pack('>H',len(p))+p
iptc=iptc_record(80,'Test Photographer') + iptc_record(120,'Synthetic caption')
resource=b'Photoshop 3.0\0'+b'8BIM'+struct.pack('>H',0x0404)+b'\0\0'+struct.pack('>I',len(iptc))+iptc+(b'\0' if len(iptc)%2 else b'')
for n in range(1,9):
    path=root/f'orientation-{n}.jpg'
    image.save(path,quality=90,exif=exif(n),icc_profile=icc,progressive=True)
    b=path.read_bytes()
    b=b[:2]+jpeg_marker(0xe1,b'http://ns.adobe.com/xap/1.0/\0'+xmp)+jpeg_marker(0xed,resource)+jpeg_marker(0xfe,b'Synthetic private comment')+b[2:]
    path.write_bytes(b)
image.save(root/'plain.jpg',quality=90)
info=PngImagePlugin.PngInfo(); info.add_text('Author','Test Creator'); info.add_text('Comment','Compressed private comment',zip=True)
info.add_itxt('XML:com.adobe.xmp',xmp.decode(),zip=True)
image.save(root/'metadata.png',pnginfo=info,exif=exif(1),icc_profile=icc)
b=(root/'metadata.png').read_bytes(); (root/'metadata.png').write_bytes(b[:-12]+png_chunk(b'tIME',bytes([7,234,1,2,3,4,5]))+b[-12:])
image.save(root/'metadata.webp',format='WEBP',lossless=True,exif=exif(1),icc_profile=icc,xmp=xmp)
image.save(root/'rotated.webp',format='WEBP',lossless=True,exif=exif(6),icc_profile=icc)
tiff_exif = Image.Exif(); tiff_exif.load(exif(1).tobytes())
image.save(root/'metadata.tiff',format='TIFF',exif=tiff_exif)
second=image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
image.save(root/'animated.webp',save_all=True,append_images=[second],duration=120,loop=0,lossless=True,exif=exif(1),xmp=xmp)
image.save(root/'animated.png',save_all=True,append_images=[second],duration=120,loop=0,pnginfo=info,exif=exif(1))
(root/'private.pdf').write_bytes(b'%PDF-1.7\nSynthetic unsupported file\n')
(root/'broken.jpg').write_bytes(b'\xff\xd8\xff\xe1\xff\xffExif\0\0')
print('Synthetic image fixtures generated.')
