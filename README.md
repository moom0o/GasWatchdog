# GasWatchdog
Fill up your car at the lowest possible price in Michigan and beat the Edgeworth Price Cycle!

<img width="425" height="278" alt="image" src="https://github.com/user-attachments/assets/d5479e2a-8606-4d27-9561-283600c777c8" />
<img width="540" height="239" alt="Screenshot_20251208-152926" src="https://github.com/user-attachments/assets/5e9aebab-dc4b-410b-ad74-5961015d2c70" />
<img width="1164" height="432" alt="image" src="https://github.com/user-attachments/assets/f075850d-b324-4dd7-b18c-a99353bef3cc" />

Fetch Wesco API to detect gas price increases in Michigan since they love to increase by 50 cents or more overnight due to midwest price cycling

API found by reverse engineering the wesco android app, may add other stations in the future

Once the first price change is detected, you usually have a few hours to get gas before it spikes 50 cents or more at your local station unless the first change happened to be your station.

Web page is experimental/laggy but you can see it at https://gas.moomoo.me

## Config options
Nothing should have to be changed besides webhook url unless the API gets updated. The DEVICE UID can be any random string.