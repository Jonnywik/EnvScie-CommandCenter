"""Compact CFR1 SOS payload codec.

The CRC is only an integrity check; it is not authentication. In production the SMS
provider/gateway must authenticate the sender or add a gateway signature before the
payload is accepted as a verified emergency report.

Wire format:
CFR1;device;nonce;type;lat5;lon5;accuracy;unix_seconds;crc32

lat5/lon5 are signed integer degrees multiplied by 100000 and encoded in base36.
The format is intentionally human-debuggable and comfortably below one SMS segment
for the expected device/type identifiers.
"""

from __future__ import annotations

import re
import zlib
from dataclasses import dataclass

from app.schemas.sos import DecodedSmsSos

BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"
PAYLOAD_RE = re.compile(r"^CFR1;([^;]+);([^;]+);([^;]+);([^;]+);([^;]+);([^;]+);([0-9]+);([0-9A-Fa-f]{8})$")


class PayloadError(ValueError):
    pass


def _to_base36(value: int) -> str:
    sign = "-" if value < 0 else ""
    value = abs(value)
    if value == 0:
        return "0"
    chars: list[str] = []
    while value:
        value, remainder = divmod(value, 36)
        chars.append(BASE36[remainder])
    return sign + "".join(reversed(chars))


def _from_base36(value: str) -> int:
    sign = -1 if value.startswith("-") else 1
    digits = value[1:] if sign == -1 else value
    if not digits or any(char.lower() not in BASE36 for char in digits):
        raise PayloadError("invalid base36 coordinate")
    result = 0
    for char in digits.lower():
        result = result * 36 + BASE36.index(char)
    return sign * result


def _crc(body: str) -> str:
    return f"{zlib.crc32(body.encode("ascii")) & 0xFFFFFFFF:08X}"


def encode_sms_payload(
    *,
    device_public_id: str,
    nonce: str,
    emergency_type: str,
    latitude: float,
    longitude: float,
    accuracy_meters: int | None,
    client_epoch: int,
) -> str:
    lat_i = round(latitude * 100_000)
    lon_i = round(longitude * 100_000)
    body = ";".join(
        [
            "CFR1",
            device_public_id,
            nonce,
            emergency_type,
            _to_base36(lat_i),
            _to_base36(lon_i),
            str(accuracy_meters or 0),
            str(client_epoch),
        ]
    )
    payload = f"{body};{_crc(body)}"
    if len(payload) > 160:
        raise PayloadError("payload exceeds one SMS segment")
    return payload


def decode_sms_payload(payload: str) -> DecodedSmsSos:
    normalized = payload.strip()
    match = PAYLOAD_RE.fullmatch(normalized)
    if not match:
        raise PayloadError("malformed CFR1 payload")

    device, nonce, emergency_type, lat36, lon36, accuracy, epoch_text, received_crc = match.groups()
    body = normalized.rsplit(";", 1)[0]
    if _crc(body).upper() != received_crc.upper():
        raise PayloadError("CRC mismatch")

    latitude = _from_base36(lat36) / 100_000
    longitude = _from_base36(lon36) / 100_000
    return DecodedSmsSos(
        version=1,
        device_public_id=device,
        nonce=nonce,
        emergency_type=emergency_type,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=int(accuracy) or None,
        client_epoch=int(epoch_text),
        crc_hex=received_crc.upper(),
    )
