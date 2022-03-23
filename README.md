# flash-killer-keeper
This keeper checks the flash-killer to see if its `kill()` function is
available.  If so, it will call it.  This ensures that flash mints are
disabled if emergency shutdown is triggered.

## Install
```
npm install
```

## Make configuration changes
Simply edit index.js and change `WS_RPC` to your webocket URL.

## Run
```
npm start
```
