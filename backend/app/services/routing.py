from __future__ import annotations

import heapq
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from math import hypot
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class RouteResult:
    center_id: UUID
    center_name: str
    distance_meters: float
    estimated_seconds: int
    route: list[tuple[float, float]]
    avoided_hazard_count: int
    route_is_safe_as_of: datetime


async def find_nearest_safe_center(
    session: AsyncSession,
    *,
    latitude: float,
    longitude: float,
    max_centers_to_try: int = 8,
    destination_center_id: UUID | None = None,
) -> RouteResult:
    """Find the closest reachable open center using an active-flood-filtered graph.

    This is intentionally a small, auditable implementation for a municipality-sized
    graph. For a much larger road network, replace the in-process Dijkstra call with
    pgRouting or a precomputed routing service while keeping the same hazard filter.
    """
    start = "POINT({lon} {lat})".format(lon=longitude, lat=latitude)

    centers_sql = text(
        """
        SELECT
            ec.id,
            ec.name,
            ST_X(ec.geom) AS longitude,
            ST_Y(ec.geom) AS latitude,
            ST_Distance(ec.geom::geography, ST_GeomFromText(:start, 4326)::geography) AS distance_meters
        FROM cfr.evacuation_centers ec
        WHERE ec.status IN ('open', 'unknown')
          AND ec.occupancy_current < ec.capacity_total
          AND (:destination_center_id IS NULL OR ec.id = CAST(:destination_center_id AS uuid))
          AND NOT EXISTS (
              SELECT 1
              FROM cfr.hazard_zones hz
              WHERE hz.is_active
                AND hz.hazard IN ('flood', 'storm_surge', 'landslide', 'road_closure')
                AND hz.valid_from <= now()
                AND (hz.valid_until IS NULL OR hz.valid_until > now())
                AND ST_Intersects(ec.geom, hz.geom)
          )
        ORDER BY ec.geom::geography <-> ST_GeomFromText(:start, 4326)::geography
        LIMIT :limit
        """
    )
    centers = (await session.execute(centers_sql, {
        "start": start,
        "limit": max_centers_to_try,
        "destination_center_id": str(destination_center_id) if destination_center_id else None,
    })).mappings().all()
    if not centers:
        raise LookupError("no open evacuation center outside active flood polygons")

    edges_sql = text(
        """
        SELECT
            rs.id,
            rs.from_node,
            rs.to_node,
            rs.base_cost_seconds,
            rs.is_one_way,
            ST_X(ST_StartPoint(rs.geom)) AS from_lon,
            ST_Y(ST_StartPoint(rs.geom)) AS from_lat,
            ST_X(ST_EndPoint(rs.geom)) AS to_lon,
            ST_Y(ST_EndPoint(rs.geom)) AS to_lat,
            ST_AsGeoJSON(rs.geom) AS geojson,
            (
            SELECT count(*)
              FROM cfr.hazard_zones hz
              WHERE hz.is_active
                AND hz.hazard IN ('flood', 'storm_surge', 'landslide', 'road_closure')
                AND hz.valid_from <= now()
                AND (hz.valid_until IS NULL OR hz.valid_until > now())
                AND ST_Intersects(rs.geom, hz.geom)
            ) AS blocked_hazard_count
        FROM cfr.road_segments rs
        WHERE NOT EXISTS (
              SELECT 1
              FROM cfr.hazard_zones hz
              WHERE hz.is_active
                AND hz.hazard IN ('flood', 'storm_surge', 'landslide', 'road_closure')
                AND hz.valid_from <= now()
                AND (hz.valid_until IS NULL OR hz.valid_until > now())
                AND ST_Intersects(rs.geom, hz.geom)
        )
        """
    )
    edge_rows = (await session.execute(edges_sql)).mappings().all()
    if not edge_rows:
        raise LookupError("no safe road segments remain after flood filtering")

    route = _build_graph_and_find_best_route(edge_rows, centers, latitude, longitude)
    if route is None:
        raise LookupError("no reachable evacuation center on the safe road graph")

    return route


def _build_graph_and_find_best_route(
    edge_rows: list[dict[str, Any]],
    centers: list[dict[str, Any]],
    start_latitude: float,
    start_longitude: float,
) -> RouteResult | None:
    nodes: dict[int, tuple[float, float]] = {}
    neighbors: dict[int, list[tuple[int, float, list[tuple[float, float]]]]] = defaultdict(list)

    for row in edge_rows:
        from_node = int(row["from_node"])
        to_node = int(row["to_node"])
        forward = [(float(row["from_lon"]), float(row["from_lat"]))]
        reverse = [(float(row["to_lon"]), float(row["to_lat"]))]
        try:
            coordinates = json.loads(row["geojson"])["coordinates"]
            forward = [(float(lon), float(lat)) for lon, lat in coordinates]
            reverse = list(reversed(forward))
        except (TypeError, KeyError, json.JSONDecodeError):
            pass

        nodes[from_node] = forward[0]
        nodes[to_node] = forward[-1]
        cost = float(row["base_cost_seconds"])
        neighbors[from_node].append((to_node, cost, forward))
        if not bool(row["is_one_way"]):
            neighbors[to_node].append((from_node, cost, reverse))

    start_node = _nearest_node(nodes, start_longitude, start_latitude)
    if start_node is None:
        return None

    for center in centers:
        target_node = _nearest_node(nodes, float(center["longitude"]), float(center["latitude"]))
        if target_node is None:
            continue
        found = _dijkstra(neighbors, start_node, target_node)
        if found is None:
            continue
        total_seconds, node_path, edge_path = found
        route: list[tuple[float, float]] = [(start_longitude, start_latitude)]
        for edge_coordinates in edge_path:
            route.extend(edge_coordinates[1:])
        route.append((float(center["longitude"]), float(center["latitude"])))
        return RouteResult(
            center_id=center["id"],
            center_name=center["name"],
            distance_meters=float(center["distance_meters"]),
            estimated_seconds=round(total_seconds),
            route=route,
            avoided_hazard_count=0,
            route_is_safe_as_of=datetime.now(timezone.utc),
        )
    return None


def _nearest_node(nodes: dict[int, tuple[float, float]], longitude: float, latitude: float) -> int | None:
    if not nodes:
        return None
    return min(nodes, key=lambda node: hypot(nodes[node][0] - longitude, nodes[node][1] - latitude))


def _dijkstra(
    neighbors: dict[int, list[tuple[int, float, list[tuple[float, float]]]]],
    start: int,
    target: int,
) -> tuple[float, list[int], list[list[tuple[float, float]]]] | None:
    queue: list[tuple[float, int]] = [(0.0, start)]
    best: dict[int, float] = {start: 0.0}
    previous: dict[int, tuple[int, list[tuple[float, float]]]] = {}

    while queue:
        cost, node = heapq.heappop(queue)
        if node == target:
            break
        if cost != best.get(node):
            continue
        for next_node, edge_cost, geometry in neighbors.get(node, []):
            candidate = cost + edge_cost
            if candidate < best.get(next_node, float("inf")):
                best[next_node] = candidate
                previous[next_node] = (node, geometry)
                heapq.heappush(queue, (candidate, next_node))

    if target not in best:
        return None

    nodes_path: list[int] = [target]
    edges_path: list[list[tuple[float, float]]] = []
    cursor = target
    while cursor != start:
        parent, geometry = previous[cursor]
        nodes_path.append(parent)
        edges_path.append(geometry)
        cursor = parent
    nodes_path.reverse()
    edges_path.reverse()
    return best[target], nodes_path, edges_path
