# Provincial Weather Workspace — Source Research Notes

Research date: 20 August 2026.

## Confirmed sources and safe use

| Source | Confirmed capability | Implementation role | Operational limit |
|---|---|---|---|
| [PAGASA Visayas regional forecast](https://www.pagasa.dost.gov.ph/regional-forecast/visprsd) | Current regional conditions, five-day outlook, wind and coastal conditions, and visible rainfall-warning, thunderstorm-advisory, and impact-based-forecast notices. | The live provincial situation narrative and the official-warning panel. | Advisory text must be filtered for Eastern Samar before it is treated as locally relevant; a regional advisory does not establish barangay-level conditions. |
| [PAGASA severe weather bulletin](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin) | Active tropical-cyclone positions, issuance details, and forecast text when published. | Tropical-cyclone status and a link to the original bulletin. | It does not itself confirm ground impacts, road conditions, or evacuation safety. |
| [Project NOAH hazard-map open data](https://data.bettergov.ph/datasets/22) | Flood, landslide, and storm-surge hazard-map data. | Reference hazard catalogue, links, and future province-filtered spatial overlays. | The source is a static hazard reference rather than a real-time incident or rainfall feed. |
| [Project NOAH hazard-map repository](https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps) | Province-level shapefile archives and PMTiles. The documentation describes 5-, 25-, and 100-year flood-return-period maps; landslide-susceptibility layers; and four storm-surge-advisory layers. It documents flood classes of low (0–0.5 m), medium (>0.5–1.5 m), and high (>1.5 m), subject to the source's depth-and-velocity method. | Provider metadata, explicit hazard-class legend, and a direct external map reference. | The combined PMTiles file is multi-gigabyte and unsuitable for directly loading as a live Command Center dependency. A curated Eastern Samar extract or a suitable official tile service is needed before in-app province-wide polygons can be displayed. |

## Design decision

The repository lists province-specific Eastern Samar packages, including a 100-year flood archive, a landslide-hazard archive, and an SSA-1 storm-surge archive. The flood and landslide packages are too large to add directly as a browser-time dependency without a managed preprocessing and hosting pipeline. The storm-surge package is smaller but still needs provenance-preserving conversion and visual validation before it can become an operational overlay.

The first delivery will therefore show **live PAGASA situation and warnings** together with an explicit **Project NOAH reference-hazard catalogue** and direct source links. It will not fabricate province-wide polygons from limited Balangiga operational data or characterize static hazard models as live flood observations. A follow-on spatial layer will require an inspected Eastern Samar Project NOAH extract or an appropriate service endpoint.

## Live implementation verification

On 20 August 2026, the Command Center’s provincial workspace successfully rendered a PAGASA Visayas forecast-card summary, its regional issue time, bounded rainfall and thunderstorm statements, Project NOAH Eastern Samar flood/landslide/storm-surge reference cards, and direct provider links. The observed regional advisory did not explicitly name Eastern Samar, so the interface correctly labelled its applicability **Regional—verify** rather than presenting it as province-specific.

The interface also displayed the Project NOAH items as **Static reference only** and repeated their decision limits. It included a required verification sequence and an explicit link back to the live Risk Map; no page element claimed a weather narrative or model layer established live flood extent, road passability, evacuation safety, or an evacuation order.

The workspace handoff to the Risk Map was verified in the running production Command Center, and the updated number-key navigation returned from the map to **Provincial Weather** through key `4`. This confirms the new workspace is available through both the side navigation and the existing operator-continuity workflow.

The final running source directory presents four transparent cross-check links: the PAGASA Visayas regional forecast, the official PAGASA severe-weather bulletin, the Project NOAH hazard-map catalogue, and the Project NOAH Eastern Samar source repository. The tropical-cyclone bulletin is supplementary official context; the regional source and Project NOAH reference data remain clearly differentiated by their live-versus-static roles.

## References

1. [PAGASA — Visayas regional forecast](https://www.pagasa.dost.gov.ph/regional-forecast/visprsd)
2. [PAGASA — severe weather bulletin](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin)
3. [BetterGov.ph — Project NOAH Hazard Maps](https://data.bettergov.ph/datasets/22)
4. [BetterGovPH — Project NOAH Hazard Maps repository and documentation](https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps)
