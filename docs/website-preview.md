# Website Preview

The Next.js dashboard is exposed through the temporary public URL:

`https://3001-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer`

Port 3000 was already occupied by an earlier local Next.js process, so the current preview runs on port 3001. The corrected public URL resolves to the Code for Resilience dashboard; the initial page load may briefly display `Loading Balangiga command center…` while the browser waits for the FastAPI demo snapshot.

## Verified public render

After exposing the API on port 8000 and configuring the dashboard with its public API base URL, the public dashboard rendered successfully. The verified view showed the Balangiga LGU header, live-operations status, situation metrics, flood/SOS/center map layers, priority SOS queue, verified alert feed, and evacuation capacity panel.
