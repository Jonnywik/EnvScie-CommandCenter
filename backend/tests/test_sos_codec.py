import pytest

from app.services.sos_codec import PayloadError, decode_sms_payload, encode_sms_payload


def test_sms_codec_round_trip() -> None:
    payload = encode_sms_payload(
        device_public_id="a1b2c3d4",
        nonce="k9m2x7",
        emergency_type="MED",
        latitude=11.1264,
        longitude=125.3892,
        accuracy_meters=25,
        client_epoch=1780000000,
    )

    decoded = decode_sms_payload(payload)

    assert len(payload) <= 160
    assert decoded.device_public_id == "a1b2c3d4"
    assert decoded.emergency_type == "MED"
    assert decoded.latitude == pytest.approx(11.1264, abs=0.00001)
    assert decoded.longitude == pytest.approx(125.3892, abs=0.00001)
    assert decoded.accuracy_meters == 25


def test_sms_codec_rejects_corrupted_crc() -> None:
    payload = encode_sms_payload(
        device_public_id="a1b2c3d4",
        nonce="k9m2x7",
        emergency_type="TRAP",
        latitude=11.1264,
        longitude=125.3892,
        accuracy_meters=None,
        client_epoch=1780000000,
    )
    corrupted = payload[:-1] + ("0" if payload[-1] != "0" else "1")

    with pytest.raises(PayloadError, match="CRC mismatch"):
        decode_sms_payload(corrupted)


def test_sms_codec_rejects_overlong_device_identifier() -> None:
    with pytest.raises(PayloadError, match="exceeds one SMS segment"):
        encode_sms_payload(
            device_public_id="x" * 140,
            nonce="k9m2x7",
            emergency_type="MED",
            latitude=11.1264,
            longitude=125.3892,
            accuracy_meters=None,
            client_epoch=1780000000,
        )
