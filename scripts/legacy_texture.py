"""Decode the old Android RGBA4444 payload mislabeled ARGB4444 by modern readers.

Unity 3.5.2 Android Sprite RainBow stores R:G:B:A in bits 12:8:4:0.
Both modern recovery readers interpret format ID 2 as A:R:G:B instead.
Decode the original bytes, preserving all four-bit alpha levels (no color key).
"""
import struct
from PIL import Image

def decode_rgba4444(raw,width,height):
    if len(raw)<width*height*2:raise ValueError('Truncated RGBA4444 texture')
    pixels=bytearray()
    for (word,) in struct.iter_unpack('<H',raw[:width*height*2]):
        pixels.extend(((word>>shift)&15)*17 for shift in (12,8,4,0))
    return Image.frombytes('RGBA',(width,height),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)

def export_rainbow(root,destination):
    import UnityPy
    source=root/'recovered/episode-1/apk/assets/bin/Data/sharedassets5.assets'
    for obj in UnityPy.load(str(source)).objects:
        if obj.type.name!='Texture2D':continue
        texture=obj.read()
        if texture.m_Name!='Sprite RainBow':continue
        if texture.m_TextureFormat!=2:raise ValueError('Unexpected original rainbow texture format')
        decode_rgba4444(bytes(texture.image_data),texture.m_Width,texture.m_Height).save(destination)
        return
    raise ValueError('Original Sprite RainBow texture is missing')


def export_legacy_texture(root,asset,name,destination):
    import UnityPy
    source=root/'recovered/episode-1/apk/assets/bin/Data'/asset
    for obj in UnityPy.load(str(source)).objects:
        if obj.type.name!='Texture2D':continue
        texture=obj.read()
        if texture.m_Name!=name:continue
        if texture.m_TextureFormat!=2:raise ValueError('Unexpected legacy texture format: '+name)
        decode_rgba4444(bytes(texture.image_data),texture.m_Width,texture.m_Height).save(destination)
        return
    raise ValueError('Original texture missing: '+name)
