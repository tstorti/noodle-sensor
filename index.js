var config = require("./config/config.js");

//library for temp/humidity sensor
var BME280 = require('node-adafruit-bme280');

//library for read/write on gpio pins
var gpio = require("rpi-gpio");

//library for MCP3800
var mcpadc = require("mcp-spi-adc");

//ajax library for post and get requests
var request = require('ajax-request');


var app = {

    isPumpOn: false,
    isLightOn: false,
    isAutoPumpOn: false,
    isAutoLightOn: false,
    currentTargetSoil: 0,
    currentTemp:0,
    currentHumid:0,
    currentSoil: 0,
    currentLight:0,
    currentWater:0,
    autoPumpInterval:null,

    collectData: function(){
        //interval defines how often new data is grabbed
        var dataInterval = setInterval(function(){

            var probe1 = new Promise(function (resolve, reject) {
                BME280.probe(function(temperature, pressure, humidity) {
                    console.log("Temperature: "+ temperature);
                    console.log("Current Humidity: "+ humidity);
                    app.currentTemp = temperature;
                    app.currentHumid = humidity;
                    resolve();                
                });
            });
            var probe2 = new Promise(function (resolve, reject) {
                
                var lightSensor = mcpadc.open(0,{speed:20000},function(err){
					if (err) throw err;
					lightSensor.read(function(err, reading){
						if (err) throw err;
			
						//reading.value returns a number between 0 and 1.  The lower the value, the brighter the light source
						console.log("photoresistor reading: "+ reading.value);
						app.currentLight = reading.value;
						resolve();
					});
                });
            });
            var probe3 = new Promise(function(resolve, reject){
                
                var soilSensor = mcpadc.open(1,{speed:20000},function(err){
					if (err) throw err;
					soilSensor.read(function(err, reading){
						if (err) throw err;
			
						//reading.value returns a number between 0 and 1. 
						//if totally dry conditions, returns 1.  Sensor submerged in water returns ~0.5
						console.log("soil moisture reading: "+ reading.value);
						app.currentSoil = reading.value;
						resolve();
					});
                });
                
            });

            var probe4 = new Promise(function(resolve, reject){
                
                var waterSensor = mcpadc.open(2,{speed:20000},function(err){
					if (err) throw err;
					waterSensor.read(function(err, reading){
						if (err) throw err;
			
						//reading.value returns a number between 0 and 1. 
						//if totally dry conditions, returns 0.  Sensor submerged in water returns 1.
						console.log("water level reading: "+ reading.value);
						app.currentWater = reading.value;
						resolve();
					});
                }); 
            });
            
            //record data once all the probes collect measurements
            Promise.all([probe1, probe2, probe3, probe4]).then(function(){
                app.recordData();
            });

        },300000);
    },

    recordData: function(){

        //do post request to the api with all of the current sensor data and settings
        request({
            url: "https://noodle-northwestern.herokuapp.com/api/record/",
            method: 'POST',
            data: {
                temp: app.currentTemp,
                humid: app.currentHumid,
                soil: app.currentSoil,
                light: app.currentLight,
                water:app.currentWater,
                pumpOn: app.isPumpOn,
                lightOn: app.isLightOn,
                autoLightOn: app.isAutoLightOn,
                autoPumpOn: app.isAutoPumpOn,
                targetSoil: app.currentTargetSoil,
                SensorId: config.settings.deviceID,
            }
        }, function(err, res, body) {
            if(err){
                return(err);
            }
            console.log("data posted");
        });

    }, 
	
    getSettings:function(){
        //interval defines how often we check server for new settings
        var settingsInterval = setInterval(function(){

            var url = "https://noodle-northwestern.herokuapp.com/api/config/" + config.settings.deviceID;
            request({
                url: url,
                method: 'GET'
            }, function(err, res, body) {
                if(err){
                    return(err);
                }
                var status = JSON.parse(body);
                
                //update pump
                if(status.pumpOn){
                    app.pumpOn();
                }
                else{
                    app.pumpOff();
                }
                //update light
                if(status.lightOn){
                    app.lightOn();
                }
                else{
                    app.lightOff();
                }
                //if autoPump is on, use target soil moisture to begin cycling water pump every 10 min until target is reached whenever plant gets too dry.
                if(status.autoPumpOn){
                    app.autoPumpOn();
                }
                
                //auto light not configured.
                app.isAutoLightOn= status.autoLightOn;
                app.currentTargetSoil= status.targetSoil;
                   
            });
        },5000);

    },
    
    initApp: function(){
        this.initGPIO();
        this.getSettings();
        this.collectData();
    },

    initGPIO: function(){
        //this is for relay channel one (water pump)
        gpio.setup(11, gpio.DIR_HIGH);
        //this is for relay channel two (light on/off)
        gpio.setup(12, gpio.DIR_HIGH);
    },

    //this function auto-waters every 10 minutes if the target moisture level is not being met.
    autoPumpOn: function(){
        //check to make sure autoPump isnt already on - so we don't create duplicate interval
        if(app.currentTargetSoil < currentSoil && this.isAutoPumpOn === false){
            this.isAutoPumpOn = true;
            //turn on pump for 10 seconds
            app.pumpOn();
            
            //keep running pump every 10 minutes until soil moisture meets target
            app.autoPumpInterval = setInterval(function(){
                app.pumpOn();
            },600000); 
        }
        //if autoPump is already running, and soil reaches appropriate moisture level, turn off watering
        else if (app.currentTargetSoil >= currentSoil && this.isAutoPumpOn === true){
            //turn off pump interval
            clearInterval(app.autoPumpInterval)
            this.isAutoPumpOn = false;
        }              
    },
    
    //close relay circuit for channel 11
    pumpOn: function(){
        
        //check to see if pump is already running
        if(this.isPumpOn===false){
           console.log("turning pump relay on");
            this.isPumpOn = true;
            gpio.write(11, false); 
            
            //turn pump off after 10 seconds
            setTimeout(function(){ 
                
                app.pumpOff();
                //update the db so the pump isn't restarted again when status is refreshed.
                var updates = "id="+ config.settings.deviceID+"&pumpOn=false";
                $.ajax({       
                    type: 'PUT',
                    url: 'https://noodle-northwestern.herokuapp.com/api/config/update',
                    data: updates,
                    success: function(data) {    
                        console.log("database updated with pump status");
                    },
                });
                
            }, 10000);
        }
    },

    //open relay circuit for channel 11
    pumpOff: function(){
        console.log("turning pump relay off");
        this.isPumpOn = false;
        gpio.write(11, true);
    },

    //close relay circuit for channel 12
    lightOn: function(){
        //if status has changed
        if(this.isLightOn===false){
            console.log("turning light relay on");
            this.isLightOn=true;
            gpio.write(12, false);
        }
    },

    //open relay circuit for channel 11
    lightOff: function(){
        console.log("turning light relay off");
        this.isLightOn=false;
        gpio.write(12, true);
    }, 

};

app.initApp();


/*
//----------------------------------------------------------------
//-------Below Code for testing purposes only. -------------------
//----------------------------------------------------------------

//app.initGPIO();
console.log("Running Test scripts for device "+ config.settings.deviceID);


//turn each relay channel off/on every 10 seconds to demonstrate relay functionality:
var state = "off";
var count = 0;

var interval1 = setInterval(function(){

    if (state ==="off"){
        app.lightOn();
        app.pumpOn();
        state = "on";
    }
    else{
        app.lightOff();
        app.pumpOff();
        state="off";
    }

    count++;
    //stop cycling after 5 iterations
    if (count > 5){
        clearInterval(interval1);
    }

},10000);

//demonstrate BME280 is working by logging temp and humidity every 5 seconds.
var interval2 = setInterval(function(){
    
    BME280.probe(function(temperature, pressure, humidity) {
        //temperature in C
        console.log("Temperature: "+ temperature);
        //percentage humidity
        console.log("Current Humidity: "+ humidity);                
    });

},5000);


//demonstrate MCP3008 is working by logging input voltages from photoresitor
//connected to channel 1 of 8 on MCP3008
var lightSensor = mcpadc.open(0,{speed:20000},function(err){
	if (err) throw err;

	var interval3 = setInterval(function(){
		lightSensor.read(function(err, reading){
			if (err) throw err;
			
			//reading.value returns a number between 0 and 1.  The lower the value, the brighter the light source
			console.log("photoresistor reading: "+ reading.value);
		});

	},5000);
});


//soil moisture reading - connected to channel #2 of 8 on mcp3008 using analog out
var soilMoistureSensor = mcpadc.open(1,{speed:20000},function(err){
	if (err) throw err;

	var interval4 = setInterval(function(){
		soilMoistureSensor.read(function(err, reading){
			if (err) throw err;
			
			//reading returns a number between 0 and 1.  
			//if totally dry conditions, returns 1.  Sensor submerged in water returns ~0.5
			console.log("soil moisture reading: "+ reading.value);
		});

	},5000);
});
*/
