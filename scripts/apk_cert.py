# بصمة شهادة توقيع APK (مخطط v2/v3): python3 -I scripts/apk_cert.py file.apk
# مفتاح التجربة (gangcity-debug.keystore) يطبع b18f4cfb677608c87be815ad: غيرها يعني أن النسخة لن تُثبَّت فوق السابقة
import sys, struct, hashlib
data = open(sys.argv[1], 'rb').read()
eocd = data.rfind(b'PK\x05\x06')
cd_off = struct.unpack('<I', data[eocd + 16:eocd + 20])[0]
magic = data[cd_off - 16:cd_off]
assert magic == b'APK Sig Block 42', 'no signing block'
size = struct.unpack('<Q', data[cd_off - 24:cd_off - 16])[0]
block = data[cd_off - size - 8:cd_off - 24]
pos = 8
def u32(b, p): return struct.unpack('<I', b[p:p + 4])[0]
while pos < len(block):
    ln = struct.unpack('<Q', block[pos:pos + 8])[0]; bid = u32(block, pos + 8); val = block[pos + 12:pos + 8 + ln]; pos += 8 + ln
    if bid in (0x7109871a, 0xf05368c0):
        signers = val[4:]; s = signers[4:]          # أول موقّع
        signed = s[4:4 + u32(s, 0)]
        digests = signed[4:4 + u32(signed, 0)]; rest = signed[4 + len(digests):]
        certs = rest[4:4 + u32(rest, 0)]
        cert = certs[4:4 + u32(certs, 0)]
        print(hex(bid), hashlib.sha256(cert).hexdigest()[:24]); break
