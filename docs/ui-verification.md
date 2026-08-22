# UI Verification Notes

The local Next.js command-center dashboard rendered successfully at `http://localhost:3000` with the FastAPI demo API at `http://127.0.0.1:8000/v1`.

The verified view includes the Balangiga LGU header, connection status, command-center navigation, four operational metric cards, an illustrated flood/SOS/evacuation map, the priority SOS queue, verified alert feed, and evacuation capacity cards. The queue correctly displayed smoke-test SOS records and the seeded incidents.

Selecting an SOS queue row opened the interactive triage drawer with current status, incident summary, coordinates, channel, location accuracy, and actions for acknowledge, dispatch, and resolve. The browser exposed the expected interactive controls and no rendering error was observed.
