# GasWatchdog
![NodeJS](https://img.shields.io/badge/Node.js-Automation_Script-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Data_Persistence-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Unirest](https://img.shields.io/badge/Unirest-HTTP_Client-E34F26?style=for-the-badge&logo=npm&logoColor=white)

Fill up your car at the lowest possible price in Michigan and beat the Edgeworth Price Cycle by recieving notifications when prices are about to skyrocket!
<img width="425" height="278" alt="image" src="im1.png" />
<img width="540" height="239" alt="Screenshot_20251208-152926" src="im2.png" />

## API Requests
Implemented an automatic token rotation system. If the API returns a 403 Forbidden, the script intercepts the error, hits the /refreshToken endpoint using the device fingerprint, updates the in-memory session, and retries the original request without crashing.

```mermaid
graph TD
    %% --- Trigger ---
    Start((Cron Timer)) -->|Every 5m| LoadState[Load Previous Prices]
    LoadState --> ApiReq[POST /map/list]

    subgraph "Authentication System"
    ApiReq --> Status{Status Code?}
    
    Status --403 Forbidden--> Refresh[POST /refreshToken]
    Refresh -->|Using Device/Build ID| SaveToken[Update Token in RAM]
    SaveToken -->|Retry Request| ApiReq
    end

    %% --- Section 2: Data Processing ---
    Status --200 OK--> Transact[Begin SQLite Transaction]
    Transact --> Iterate[Iterate Stations]

    subgraph "Change Detection"
    Iterate --> Compare{Price Changed?}
    
    %% The Optimization: Skip DB if no change
    Compare --No (Skip)--> Next
    
    %% The Update Path
    Compare --Yes--> DeltaCheck{Delta > $0.10?}
    
    DeltaCheck --Yes--> Ping[Webhook: Ping]
    DeltaCheck --No--> Silent[Webhook: Standard Alert]
    
    Ping & Silent --> Insert[Stage DB Update]
    Insert --> Next{More Stations?}
    end

    %% --- Section 3: Persistence ---
    Next --Yes--> Iterate
    Next --No--> Commit[Commit Transaction]
    Commit --> Sleep([Wait for Next Cycle])
```
<img width="1164" height="432" alt="image" src="im3.png" />

Fetch Wesco API to detect gas price increases in Michigan since they love to increase by 50 cents or more overnight due to midwest price cycling

API found by reverse engineering the wesco android app, may add other stations in the future

Once the first price change is detected, you usually have a few hours to get gas before it spikes 50 cents or more at your local station unless the first change happened to be your station.

Web page is experimental/laggy but you can see it at https://gas.moomoo.me

## Config options
Nothing should have to be changed besides webhook url unless the API gets updated. The DEVICE UID can be any random string.