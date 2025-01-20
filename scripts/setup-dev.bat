@echo off

echo Installing backend dependencies...
cd backend
cmd /c npm install

echo Installing discord bot dependencies...
cd ../discord-bot
cmd /c npm install

echo Setup completed successfully!
exit
