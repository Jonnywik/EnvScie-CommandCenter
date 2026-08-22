# High Flood-Risk Decision-Support Alert Rules

## Purpose and boundary

This operator-triggered workflow prepares a **high flood-risk review alert** for the Balangiga Command Center. It is not an automatic public warning, evacuation order, dispatch order, road-closure declaration, or assertion that flooding is occurring at a particular location. A coordinator must verify the evidence with current field reports and formally decide whether to act or communicate externally.

## Authoritative current-condition inputs

The assessment uses the existing cached PAGASA Visayas regional forecast and warning snapshot, together with the PAGASA severe-weather bulletin if a tropical cyclone is active. Current-condition evidence is eligible only when it is successfully retrieved and no more than **30 minutes old**. A stale, failed, missing, or regionally irrelevant source cannot independently create a high-risk result.

The source parser must distinguish a statement that names **Eastern Samar** or **Balangiga** from a general Visayas statement. This prevents an advisory for another province from being presented as a local flood alert. PAGASA defines heavy rain as a rate greater than 7.5 mm per hour; the workflow treats this definition as supporting context, not a locally observed rainfall measurement.[1]

## Decision rule

The system creates a **review-required high flood-risk alert** only when all of the following conditions are met:

1. The current PAGASA source is fresh and available.
2. A PAGASA warning or advisory specifically names Eastern Samar or Balangiga.
3. The local statement includes a high-impact rainfall or flood signal, such as a Heavy Rainfall Warning, `moderate to heavy rainshowers`, `heavy rain`, `flash flood`, `flood`, or an explicitly active cyclone warning that names the province.
4. The alert includes Project NOAH flood-susceptibility context for Eastern Samar as a **static planning reference**, with its source link and return-period or susceptibility label.

If the current forecast merely predicts rainshowers, or a thunderstorm watch is regional without a local high-impact rainfall signal, the system records **monitor only** rather than escalating to high flood risk. Source failure or stale evidence produces **assessment unavailable** and never promotes a hazard level.

## Operator review fields

Every evaluation must record the evaluator, request time, source timestamps, evidence excerpts, matched locality, rules that were satisfied, the Project NOAH context item, calculated status, and coordinator decision. The coordinator can mark the result reviewed, dismiss it as not locally applicable, or use it to initiate an existing, deliberate communications or operations procedure.

## Sources

[1] [PAGASA weather terminologies](https://www.pagasa.dost.gov.ph/information/weather-terminologies)

[2] [PAGASA Visayas regional forecast](https://www.pagasa.dost.gov.ph/regional-forecast/visprsd)

[3] [PAGASA flood information](https://www.pagasa.dost.gov.ph/flood)

[4] [Project NOAH hazard-map catalogue](https://data.bettergov.ph/datasets/22)
