"""Resilient public weather-feed adapters for Command Center decision support.

These adapters intentionally return a safe, explicitly stale snapshot when an
upstream service is unavailable.  They do not infer field conditions, damage,
route safety, or evacuation status from public weather data.
"""

from __future__ import annotations

import asyncio
import copy
import html
import re
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json"
PAGASA_BULLETIN_URL = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin"
PAGASA_VISAYAS_FORECAST_URL = "https://www.pagasa.dost.gov.ph/regional-forecast/visprsd"
PAGASA_RADAR_URL = "https://www.pagasa.dost.gov.ph/radar"
PAGASA_SATELLITE_URL = "https://www.pagasa.dost.gov.ph/products-and-services/satellite"
PANAHON_URL = "https://www.panahon.gov.ph/"
PROJECT_NOAH_DATASET_URL = "https://data.bettergov.ph/datasets/22"
PROJECT_NOAH_REPOSITORY_URL = "https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps"
RADAR_CACHE_TTL_SECONDS = 300
TYPHOON_CACHE_TTL_SECONDS = 600
PROVINCIAL_WEATHER_CACHE_TTL_SECONDS = 600
REQUEST_TIMEOUT_SECONDS = 5.0
PROVINCIAL_FORECAST_TIMEOUT_SECONDS = 12.0
RAINVIEWER_MAX_ZOOM = 7

_radar_cache: dict[str, Any] | None = None
_typhoon_cache: dict[str, Any] | None = None
_provincial_weather_cache: dict[str, Any] | None = None
_cache_lock = asyncio.Lock()


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _copy(snapshot: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(snapshot)


def _cached_value(cache: dict[str, Any] | None, ttl_seconds: int) -> dict[str, Any] | None:
    if cache is None or time.monotonic() - cache["stored_at"] > ttl_seconds:
        return None
    snapshot = _copy(cache["snapshot"])
    snapshot["stale"] = False
    return snapshot


def _stale_value(cache: dict[str, Any] | None, fallback: dict[str, Any]) -> dict[str, Any]:
    if cache is None:
        return fallback
    snapshot = _copy(cache["snapshot"])
    snapshot["stale"] = True
    return snapshot


def _unconfigured_overlay(
    *,
    overlay_id: str,
    kind: str,
    provider: str,
    source_url: str,
    coverage: str,
    decision_limit: str,
    access_state: str = "pending_approval",
) -> dict[str, Any]:
    """Return an explicit disabled state without querying an unapproved provider."""
    return {
        "id": overlay_id,
        "kind": kind,
        "provider": provider,
        "source_url": source_url,
        "observed_at": None,
        "fetched_at": _utcnow(),
        "expires_at": None,
        "freshness": "unavailable",
        "coverage": coverage,
        "resolution": None,
        "decision_limit": decision_limit,
        "access_state": access_state,
        "message": "Provider access is pending. No external feed was requested.",
    }


async def get_map_overlays_snapshot() -> dict[str, Any]:
    """Return one safe map-overlay contract for a Command Map refresh.

    Existing public RainViewer/PAGASA bulletin adapters remain available. PAGASA
    radar, station, satellite, and licensed lightning integrations deliberately
    stay disabled until the LGU has documented provider access and credentials.
    This function never scrapes or hotlinks those pending providers.
    """
    radar, typhoon = await asyncio.gather(get_radar_snapshot(), get_typhoon_snapshot())
    pagasa_radar = _unconfigured_overlay(
        overlay_id="pagasa-radar-qpe",
        kind="radar_qpe",
        provider="PAGASA",
        source_url=PAGASA_RADAR_URL,
        coverage="Philippine radar/QPE coverage pending approved product scope",
        decision_limit="Not enabled. A future radar/QPE layer will remain decision support and will not confirm flood depth, road clearance, or field safety.",
    )
    pagasa_stations = _unconfigured_overlay(
        overlay_id="pagasa-stations",
        kind="station_observation",
        provider="PAGASA PANaHON",
        source_url=PANAHON_URL,
        coverage="Station coverage near Balangiga pending approved data access",
        decision_limit="Not enabled. Point observations must not be interpolated into unverified barangay or road conditions.",
    )
    pagasa_satellite = _unconfigured_overlay(
        overlay_id="pagasa-himawari-context",
        kind="satellite",
        provider="PAGASA Himawari",
        source_url=PAGASA_SATELLITE_URL,
        coverage="Philippine satellite context pending approved product scope",
        decision_limit="Not enabled. Satellite imagery is not a direct observation of ground rainfall, flood depth, damage, or surface wind.",
    )
    lightning = _unconfigured_overlay(
        overlay_id="licensed-lightning",
        kind="lightning",
        provider="Licensed lightning provider",
        source_url="",
        coverage="Eastern Visayas coverage pending provider selection and contract",
        decision_limit="Not enabled. Lightning context cannot automatically hold, reroute, dispatch, or message field units.",
        access_state="pending_procurement",
    )
    lightning["message"] = "Licensed lightning provider access is pending. No lightning feed was requested."
    lightning["history_minutes"] = 15
    lightning["events"] = []
    return {
        "fetched_at": _utcnow(),
        "stale": bool(radar.get("stale") or typhoon.get("stale")),
        "rainviewer_radar": radar,
        "typhoon": typhoon,
        "pagasa_radar": {**pagasa_radar, "frames": []},
        "pagasa_stations": {**pagasa_stations, "stations": []},
        "pagasa_satellite": {**pagasa_satellite, "frame": None},
        "lightning": lightning,
        "decision_limit": "Map overlays provide operational context only and do not confirm field safety, route clearance, flood depth, damage, evacuation readiness, or transmission delivery.",
    }


async def get_radar_snapshot() -> dict[str, Any]:
    """Return recent RainViewer frame metadata with a five-minute TTL cache."""
    global _radar_cache
    fresh = _cached_value(_radar_cache, RADAR_CACHE_TTL_SECONDS)
    if fresh is not None:
        return fresh

    async with _cache_lock:
        fresh = _cached_value(_radar_cache, RADAR_CACHE_TTL_SECONDS)
        if fresh is not None:
            return fresh
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True) as client:
                response = await client.get(RAINVIEWER_URL, headers={"User-Agent": "CodeForResilience/1.0"})
                response.raise_for_status()
                payload = response.json()
            host = payload.get("host")
            raw_frames = payload.get("radar", {}).get("past", [])
            frames = [
                {"time": int(frame["time"]), "path": str(frame["path"])}
                for frame in raw_frames
                if isinstance(frame, dict) and frame.get("time") is not None and frame.get("path")
            ]
            if not isinstance(host, str) or not host or not frames:
                raise ValueError("RainViewer response did not contain usable radar frames")
            snapshot = {"frames": frames, "host": host.rstrip("/"), "max_zoom": RAINVIEWER_MAX_ZOOM, "fetched_at": _utcnow(), "stale": False}
            _radar_cache = {"stored_at": time.monotonic(), "snapshot": snapshot}
            return _copy(snapshot)
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            return _stale_value(_radar_cache, {"frames": [], "host": None, "max_zoom": RAINVIEWER_MAX_ZOOM, "fetched_at": _utcnow(), "stale": True})


def _strip_html(markup: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>", " ", markup, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _coordinate(value: str, hemisphere: str) -> float:
    numeric = float(value)
    return -numeric if hemisphere.upper() in {"S", "W"} else numeric


def parse_pagasa_bulletin(markup: str) -> dict[str, Any]:
    """Extract the active storm's public position and listed forecast positions.

    PAGASA's bulletin is human-authored HTML, so parsing remains deliberately
    conservative: no coordinate means no active position is reported.
    """
    text = _strip_html(markup)
    storm_match = re.search(
        r"(?:TROPICAL\s+DEPRESSION|TROPICAL\s+STORM|SEVERE\s+TROPICAL\s+STORM|SUPER\s+TYPHOON|TYPHOON)\s+[\"“']?([A-Za-z][A-Za-z-]{1,30})",
        text,
        flags=re.IGNORECASE,
    )
    coordinate_matches = list(re.finditer(
        r"(\d{1,2}(?:\.\d+)?)\s*(?:°|DEG(?:REES?)?)?\s*([NS])\s*[,/;]\s*(\d{2,3}(?:\.\d+)?)\s*(?:°|DEG(?:REES?)?)?\s*([EW])",
        text,
        flags=re.IGNORECASE,
    ))
    issued_match = re.search(
        r"(?:ISSUED\s+AT|ISSUANCE\s+TIME)\s*[:\-]?\s*([^\.]{8,100})",
        text,
        flags=re.IGNORECASE,
    )
    fetched_at = _utcnow()
    if storm_match is None or not coordinate_matches:
        return {
            "active": False,
            "name": None,
            "latitude": None,
            "longitude": None,
            "issued_at": issued_match.group(1).strip() if issued_match else None,
            "track": [],
            "fetched_at": fetched_at,
            "stale": False,
            "source_url": PAGASA_BULLETIN_URL,
        }
    track = [
        {
            "latitude": _coordinate(match.group(1), match.group(2)),
            "longitude": _coordinate(match.group(3), match.group(4)),
        }
        for match in coordinate_matches[:8]
    ]
    return {
        "active": True,
        "name": storm_match.group(1).upper(),
        "latitude": track[0]["latitude"],
        "longitude": track[0]["longitude"],
        "issued_at": issued_match.group(1).strip() if issued_match else None,
        "track": track,
        "fetched_at": fetched_at,
        "stale": False,
        "source_url": PAGASA_BULLETIN_URL,
    }


async def get_typhoon_snapshot() -> dict[str, Any]:
    """Return a PAGASA tropical-cyclone snapshot with a ten-minute TTL cache."""
    global _typhoon_cache
    fresh = _cached_value(_typhoon_cache, TYPHOON_CACHE_TTL_SECONDS)
    if fresh is not None:
        return fresh

    async with _cache_lock:
        fresh = _cached_value(_typhoon_cache, TYPHOON_CACHE_TTL_SECONDS)
        if fresh is not None:
            return fresh
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True) as client:
                response = await client.get(PAGASA_BULLETIN_URL, headers={"User-Agent": "CodeForResilience/1.0"})
                response.raise_for_status()
            snapshot = parse_pagasa_bulletin(response.text)
            _typhoon_cache = {"stored_at": time.monotonic(), "snapshot": snapshot}
            return _copy(snapshot)
        except httpx.HTTPError:
            return _stale_value(_typhoon_cache, {
                "active": False,
                "name": None,
                "latitude": None,
                "longitude": None,
                "issued_at": None,
                "track": [],
                "fetched_at": _utcnow(),
                "stale": True,
                "source_url": PAGASA_BULLETIN_URL,
            })


def _first_match(text: str, patterns: list[str], fallback: str | None = None) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = match.group(1) if match.lastindex else match.group(0)
            return re.sub(r"\s+", " ", value).strip(" -:;.")
    return fallback


def _weather_hazard_reference() -> list[dict[str, str | list[str]]]:
    """Return source-described static hazard references, never live hazard claims."""
    repository_root = f"{PROJECT_NOAH_REPOSITORY_URL}/blob/main"
    return [
        {
            "id": "flood-risk",
            "title": "Flood-risk reference areas",
            "hazard": "flood",
            "coverage": "Eastern Samar province dataset",
            "model_scope": "Static Project NOAH flood-hazard reference",
            "classes": ["5-year return period", "25-year return period", "100-year return period"],
            "source_name": "Project NOAH Hazard Maps",
            "source_url": f"{repository_root}/Flood/100yr/EasternSamar.zip",
            "decision_limit": "Not a live flood extent, depth, road-passability, or evacuation-safety confirmation.",
        },
        {
            "id": "landslide-susceptibility",
            "title": "Landslide-susceptibility reference areas",
            "hazard": "landslide",
            "coverage": "Eastern Samar province dataset",
            "model_scope": "Static Project NOAH landslide-hazard reference",
            "classes": ["Province-level susceptibility reference"],
            "source_name": "Project NOAH Hazard Maps",
            "source_url": f"{repository_root}/Landslide/LandslideHazards/EasternSamar.zip",
            "decision_limit": "Not a live slope-failure or road-access confirmation.",
        },
        {
            "id": "storm-surge",
            "title": "Storm-surge advisory reference areas",
            "hazard": "storm_surge",
            "coverage": "Eastern Samar province dataset",
            "model_scope": "Static Project NOAH storm-surge advisory reference",
            "classes": ["Advisory scenario 1", "Additional scenarios are available from the source catalogue"],
            "source_name": "Project NOAH Hazard Maps",
            "source_url": f"{repository_root}/Storm%20Surge/StormSurgeAdvisory1/EasternSamar.zip",
            "decision_limit": "Not a live inundation boundary, tide observation, or evacuation-order substitute.",
        },
    ]


def parse_pagasa_visayas_forecast(markup: str) -> dict[str, Any]:
    """Extract conservative regional weather and warning statements from PAGASA HTML.

    PAGASA's regional page is narrative HTML rather than a stable public API. The
    parser keeps only bounded public text and labels whether Eastern Samar was
    named; it never turns a regional statement into a barangay-level claim.
    """
    def fragment(pattern: str) -> str:
        match = re.search(pattern, markup, flags=re.IGNORECASE | re.DOTALL)
        return _strip_html(match.group(1)) if match else ""

    weather_summary = fragment(r'class=["\']description["\'][^>]*>\s*(.*?)\s*</span>')
    if not weather_summary:
        weather_summary = "PAGASA regional forecast is available; review the original source for the current narrative."
    issued_at = fragment(r"Issued\s+At:\s*([^<]+)") or None
    heavy_rainfall = fragment(r'id=["\']rainfalls["\'][^>]*>\s*<div[^>]*>\s*(.*?)\s*</div>')
    if not heavy_rainfall:
        heavy_rainfall = "No heavy-rainfall warning statement was parsed from the current regional page."
    thunderstorm = fragment(r'(Thunderstorm\s+Advisory\s+No\.\s*\d+.*?)(?=<br\s*/?>\s*<br\s*/?>|</div>)')
    active_text = " ".join((weather_summary, heavy_rainfall, thunderstorm))
    eastern_samar_mentioned = bool(re.search(r"\bEASTERN\s*SAMAR\b|#EASTERNSAMAR\b", active_text, flags=re.IGNORECASE))
    warnings = [{
        "id": "heavy-rainfall",
        "type": "heavy_rainfall",
        "statement": heavy_rainfall,
        "province_specific": bool(re.search(r"\bEASTERN\s*SAMAR\b|#EASTERNSAMAR\b", heavy_rainfall, flags=re.IGNORECASE)),
        "source_url": PAGASA_VISAYAS_FORECAST_URL,
    }]
    if thunderstorm:
        warnings.append({
            "id": "thunderstorm",
            "type": "thunderstorm",
            "statement": thunderstorm,
            "province_specific": bool(re.search(r"\bEASTERN\s*SAMAR\b|#EASTERNSAMAR\b", thunderstorm, flags=re.IGNORECASE)),
            "source_url": PAGASA_VISAYAS_FORECAST_URL,
        })
    return {
        "province": "Eastern Samar",
        "regional_office": "PAGASA Visayas",
        "weather_summary": weather_summary,
        "issued_at": issued_at,
        "province_mentioned": eastern_samar_mentioned,
        "warnings": warnings,
        "hazard_references": _weather_hazard_reference(),
        "source_links": [
            {"name": "PAGASA Visayas regional forecast", "url": PAGASA_VISAYAS_FORECAST_URL, "kind": "live regional weather and warnings"},
            {"name": "PAGASA severe-weather bulletin", "url": PAGASA_BULLETIN_URL, "kind": "official tropical-cyclone bulletins and track updates"},
            {"name": "Project NOAH hazard-map catalogue", "url": PROJECT_NOAH_DATASET_URL, "kind": "static flood, landslide, and storm-surge references"},
            {"name": "Project NOAH source repository", "url": PROJECT_NOAH_REPOSITORY_URL, "kind": "Eastern Samar source-data archives"},
        ],
        "fetched_at": _utcnow(),
        "stale": False,
    }


async def get_provincial_weather_snapshot() -> dict[str, Any]:
    """Return cached official weather and Project NOAH reference information.

    The live element is PAGASA's regional situation page. Project NOAH entries
    remain explicitly static reference layers so an upstream issue cannot turn
    modelled susceptibility into a false claim about field conditions.
    """
    global _provincial_weather_cache
    fresh = _cached_value(_provincial_weather_cache, PROVINCIAL_WEATHER_CACHE_TTL_SECONDS)
    if fresh is not None:
        return fresh

    async with _cache_lock:
        fresh = _cached_value(_provincial_weather_cache, PROVINCIAL_WEATHER_CACHE_TTL_SECONDS)
        if fresh is not None:
            return fresh
        try:
            async with httpx.AsyncClient(timeout=PROVINCIAL_FORECAST_TIMEOUT_SECONDS, follow_redirects=True) as client:
                response = await client.get(PAGASA_VISAYAS_FORECAST_URL, headers={"User-Agent": "CodeForResilience/1.0"})
                response.raise_for_status()
            snapshot = parse_pagasa_visayas_forecast(response.text)
            _provincial_weather_cache = {"stored_at": time.monotonic(), "snapshot": snapshot}
            return _copy(snapshot)
        except httpx.HTTPError:
            return _stale_value(_provincial_weather_cache, {
                "province": "Eastern Samar",
                "regional_office": "PAGASA Visayas",
                "weather_summary": "PAGASA regional situation could not be refreshed. Open the source link or confirm by radio before acting.",
                "issued_at": None,
                "province_mentioned": False,
                "warnings": [],
                "hazard_references": _weather_hazard_reference(),
                "source_links": [
                    {"name": "PAGASA Visayas regional forecast", "url": PAGASA_VISAYAS_FORECAST_URL, "kind": "live regional weather and warnings"},
                    {"name": "PAGASA severe-weather bulletin", "url": PAGASA_BULLETIN_URL, "kind": "official tropical-cyclone bulletins and track updates"},
                    {"name": "Project NOAH hazard-map catalogue", "url": PROJECT_NOAH_DATASET_URL, "kind": "static flood, landslide, and storm-surge references"},
                    {"name": "Project NOAH source repository", "url": PROJECT_NOAH_REPOSITORY_URL, "kind": "Eastern Samar source-data archives"},
                ],
                "fetched_at": _utcnow(),
                "stale": True,
            })


def _snapshot_age_seconds(fetched_at: str | None) -> float | None:
    if not fetched_at:
        return None
    try:
        parsed = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return max(0.0, (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds())


async def evaluate_high_flood_risk() -> dict[str, Any]:
    """Create a coordinator-review assessment from fresh official PAGASA inputs.

    This does not create a public warning or infer live inundation. A high-risk
    result requires a fresh, Eastern-Samar-specific heavy-rainfall statement;
    regional statements intentionally remain review-required. Project NOAH only
    records exposure context and cannot elevate the result by itself.
    """
    snapshot = await get_provincial_weather_snapshot()
    age_seconds = _snapshot_age_seconds(snapshot.get("fetched_at"))
    fresh = not bool(snapshot.get("stale")) and age_seconds is not None and age_seconds <= PROVINCIAL_WEATHER_CACHE_TTL_SECONDS + 300
    warnings = snapshot.get("warnings") if isinstance(snapshot.get("warnings"), list) else []
    heavy_rainfall = next((item for item in warnings if isinstance(item, dict) and item.get("type") == "heavy_rainfall"), None)
    statement = str(heavy_rainfall.get("statement") or "") if heavy_rainfall else ""
    has_active_heavy_rainfall = bool(statement) and not statement.lower().startswith("no heavy-rainfall")
    province_specific = bool(heavy_rainfall and heavy_rainfall.get("province_specific"))

    factors: list[dict[str, str]] = []
    if not fresh:
        risk_level = "insufficient_data"
        factors.append({"signal": "PAGASA freshness gate", "status": "blocked", "detail": "The regional situation snapshot is stale or has no reliable timestamp. Confirm PAGASA by official channel before assessing risk."})
    elif has_active_heavy_rainfall and province_specific:
        risk_level = "high"
        factors.append({"signal": "PAGASA heavy-rainfall statement", "status": "met", "detail": "A fresh heavy-rainfall statement explicitly names Eastern Samar."})
    elif has_active_heavy_rainfall:
        risk_level = "review_required"
        factors.append({"signal": "PAGASA regional heavy-rainfall statement", "status": "review", "detail": "A fresh regional statement was found, but it does not explicitly name Eastern Samar."})
    else:
        risk_level = "monitor"
        factors.append({"signal": "PAGASA heavy-rainfall statement", "status": "not_met", "detail": "No active heavy-rainfall statement was parsed from the current regional source."})

    factors.append({"signal": "Project NOAH flood reference", "status": "context_only", "detail": "Eastern Samar return-period flood reference areas are shown as static exposure context and did not change the live risk level."})
    return {
        "assessment_id": str(uuid4()),
        "trigger": "operator_requested",
        "risk_level": risk_level,
        "review_required": True,
        "public_communication_sent": False,
        "evaluated_at": _utcnow(),
        "province": snapshot.get("province", "Eastern Samar"),
        "source_freshness": {"fresh": fresh, "age_seconds": round(age_seconds, 1) if age_seconds is not None else None, "source_fetched_at": snapshot.get("fetched_at"), "source_stale": bool(snapshot.get("stale"))},
        "factors": factors,
        "warning": heavy_rainfall,
        "hazard_context": [item for item in snapshot.get("hazard_references", []) if isinstance(item, dict) and item.get("hazard") == "flood"],
        "source_links": snapshot.get("source_links", []),
        "decision_limits": [
            "This assessment is a coordinator review cue, not a public warning, evacuation order, or dispatch authorization.",
            "Confirm barangay, river, road, and evacuation-center conditions through official and field channels before action.",
            "Project NOAH susceptibility and return-period layers are static references, not observed flood extent or depth.",
        ],
    }
