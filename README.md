# Traffic Alerts

The main goal behind this application is to raise awareness about road problems among the users. That way, drivers can avoid going through some path just by consulting this application.

You can see a live demo on http://cloud-25.skelabb.ltu.se

## Requirements
- MySQL 5.5.4
- Node.js v0.10.33
- Created Facebook APP (https://developers.facebook.com/apps) 


## How to install and use
    
```sh   
git clone https://github.com/mbumba/traffic-alerts
cd traffic-alerts
npm install
```
Now is the time for create new MySQL database and then import the table from file: traffic-alerts.sql
```sh
mysql -u username -p   #Type your MySQL username instead of username
#After login you should get a MySQL prompt and type this:
CREATE DATABASE traffic-alerts;
EXIT;
#Now you can import table from .sql file:
mysql -u username -p -D traffic-alerts < traffic-alerts.sql #Type your MySQL username instead of username
```
Edit the configuration file and set MySQL credentials, Facebook APP credentials.
```sh
nano config.js
```
In this point is everything ready for run the application.
```sh
node .
```
 If you didn't change application PORT, it will run on port 8888
