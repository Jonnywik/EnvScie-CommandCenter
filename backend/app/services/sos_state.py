ALLOWED_SOS_TRANSITIONS: dict[str, set[str]] = {
    "received": {"acknowledged", "false_alarm"},
    "acknowledged": {"dispatched", "resolved", "false_alarm"},
    "dispatched": {"resolved", "false_alarm"},
    "resolved": set(),
    "false_alarm": set(),
}


def is_valid_sos_transition(current: str, requested: str) -> bool:
    return requested == current or requested in ALLOWED_SOS_TRANSITIONS.get(current, set())
