# Balangiga Risk Assessment — Research Notes

_Collected 20 August 2026. These notes distinguish direct evidence from planning inferences; the final assessment must not treat province-wide or Leyte Gulf findings as barangay-specific hazard ratings._

| Topic | Evidence captured | Source |
|---|---|---|
| Municipal setting | Balangiga is on the southern coast of Samar, faces Leyte Gulf, and sits at the mouth of the Balangiga River. It has 13 barangays. | [Provincial Balangiga profile](https://easternsamar.gov.ph/balangiga-2/) |
| Municipal scale | The provincial government table reports Balangiga at 190.05 km², 13 barangays, 14,085 people in the 2015 census, and a density of 74 people/km². | [Eastern Samar geography](https://easternsamar.gov.ph/geography/) |
| Latest official census table | The PSA population workbook search result lists Balangiga at 10,662 (2000), 12,756 (2010), 14,085 (2015), and 14,341 (2020). The 2020 value should be used as the latest population baseline, subject to future PSA releases. | [PSA Table B workbook](https://psa.gov.ph/system/files/phcd/2022-12/Table%2520B%2520-%2520Population%2520and%2520Annual%2520Growth%2520Rates%2520by%2520Province%252C%2520City%252C%2520and%2520Municipality%2520-%2520By%2520Region_AGBA_rev.xlsx) |
| Provincial coastal context | Eastern Samar faces the Philippine Sea to the east and Leyte Gulf to the south; the provincial geography page says the Pacific-facing exposure causes heavy typhoon impacts. | [Eastern Samar geography](https://easternsamar.gov.ph/geography/) |
| Storm-surge mechanism | Peer-reviewed modelling of Haiyan in Leyte Gulf estimates 5–6 m storm-surge level and identifies local amplification related to the gulf bathymetry and seiche behavior. This supports scenario planning for Balangiga’s Leyte Gulf coast, not a claim of a particular surge height in every barangay. | [Mori et al., 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4373162/) |
| Extreme coastal flooding | A peer-reviewed Eastern Samar study documented boulders moved to elevations up to 10 m above mean lower low water by Haiyan-related coastal flooding and inferred very high flow velocities in particular rocky-coast sites. This is regional evidence, not a Balangiga-specific inundation depth. | [May et al., 2015](https://esurf.copernicus.org/articles/3/543/2015/) |
| Storm-surge planning basis | Project NOAH’s national study reports that Haiyan-type storm-surge simulations can support storm-tide inundation maps for land-use planning, evacuation-site placement, critical facilities, response plans, and evacuation schemes. | [Lapidez et al., 2015](https://nhess.copernicus.org/articles/15/1473/2015/) |
| Government multi-hazard data | HazardHunterPH is a DOST-PHIVOLCS multi-agency tool for government-generated seismic, volcanic, and hydrometeorologic location assessments and critical-facility screening. | [HazardHunterPH](https://hazardhunter.georisk.gov.ph/) |
| Government map layers | The DENR-MGB Geohazard Portal exposes coastal physical vulnerability, detailed flood susceptibility, rain-induced landslide susceptibility, and debris-flow paths/accumulation zones. Exact barangay and asset ratings must be exported or queried for the final operational layers. | [MGB Geohazard Portal](https://experience.arcgis.com/experience/c48f83f81f1548bdb0a76c61638d52d6) |
| Satellite basemap operating limit | Esri World Imagery presents satellite and aerial imagery; its overview describes typical high-resolution currency as within 3–5 years for much of the world and lists acknowledgements as Esri, Vantor, Earthstar Geographics, and the GIS User Community. Esri’s service terms require proper attribution and say imagery may be subject to third-party restrictions. It can provide situational geographic context, but must not be interpreted as live damage, flood-depth, road-status, or safety confirmation. | [World Imagery overview](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9); [Esri service terms](https://www.esri.com/en-us/legal/terms/web-site-service) |

### Implementation verification — 20 August 2026

The Command Center browser successfully requested the Esri World Imagery export endpoint for the active map extent and received a `200` PNG response (`684,052` bytes). The Risk Map displays the required provider acknowledgement and repeats the limit that satellite imagery is contextual, not a live confirmation of damage, flooding, road state, or safety.

## Evidence-based preliminary hazard hierarchy

1. **Typhoon wind, intense rainfall, coastal flooding/storm surge, and riverine or pluvial flooding** are high-priority planning hazards because Balangiga sits at a river mouth on Leyte Gulf in a typhoon-affected province and because the Haiyan literature documents severe Leyte Gulf/Eastern Samar coastal behavior.
2. **Rain-induced landslide and debris flow** require barangay-level screening, particularly for upland roads and slopes; the municipality’s river-mouth town center alone cannot establish terrain risk across the full 190.05 km² municipal area.
3. **Earthquake and tsunami** are lower-frequency but potentially high-consequence hazards that must remain in the operational profile. The authoritative location-specific source is HazardHunterPH/PHIVOLCS, not a generic province-level statement.
4. **Drought, heat, public-health, and service continuity impacts** should be treated as compounding operational risks, but they need PAGASA/climate and local health/service data before being quantitatively ranked.

## Data gaps to close before field deployment

- Verified critical-facility, evacuation-center, road, bridge, and power/telecom asset locations.
- Barangay-level population and household exposure, including disability, older-person, and medically dependent registries under appropriate privacy controls.
- MGB flood/landslide/debris-flow and PAGASA storm-surge outputs clipped to Balangiga, versioned with source date and scenario.
- River-level, rainfall, tide, wind, and coastal-water observations plus clearly defined warning thresholds.
- Local historical impact, evacuation, shelter, and responder deployment records.

## Selected public live-map feeds — RainViewer radar and PAGASA tropical-cyclone bulletin

**RainViewer Weather Maps API.** The public metadata endpoint is `https://api.rainviewer.com/public/weather-maps.json`. RainViewer’s Weather Maps API documentation says it exposes two hours of past radar frames in normally ten-minute steps and provides a host plus frame paths for tile requests. The documented tile pattern is `{host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png`; it represents precipitation radar coverage, not incident impact. Source: https://www.rainviewer.com/api/weather-maps-api.html

**RainViewer terms and attribution.** RainViewer states that its public API is for personal, educational, and small-scale community use, requires no key, has no SLA, and requires visible credit such as “Weather data by RainViewer” linking to `https://www.rainviewer.com/`. It advises clients to cache responses and degrade gracefully if service is unavailable. Source: https://www.rainviewer.com/api.html

**PAGASA tropical-cyclone information.** PAGASA’s Severe Weather Bulletin publishes an active cyclone’s official issuance time, hazard narrative, eye/center coordinates, motion, wind information, forecast-position text, and an official track image. The implementation must present these as the latest public bulletin, state both issue and fetch time, and show no inferred track or alert level when no active bulletin exists. Source: https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin

**Operational limitation.** These layers are decision support only. Radar precipitation imagery does not show road condition, flood depth, evacuation safety, damage, or safe routing; it cannot authorize dispatch. PAGASA bulletin content can change form and should be cached, retried, and given a visible unavailable/stale state. Dispatch remains subject to a coordinator’s verification of authoritative warning products, local conditions, route status, and field-team readiness.
