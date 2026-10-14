import unittest
from legacy_texture import decode_rgba4444

class LegacyTextureTest(unittest.TestCase):
    def test_color_alpha_and_unity_vertical_origin(self):
        image=decode_rgba4444(bytes.fromhex('f0ff0ffa0805ffff'),2,2)
        self.assertEqual(image.getpixel((0,1)),(255,255,255,0))
        self.assertEqual(image.getpixel((1,1)),(255,170,0,255))
        self.assertEqual(image.getpixel((0,0)),(0,85,0,136))
        self.assertEqual(image.getpixel((1,0)),(255,255,255,255))
    def test_truncated_payload_is_reported(self):
        with self.assertRaises(ValueError):decode_rgba4444(b'\x00',1,1)

if __name__=='__main__':unittest.main()
