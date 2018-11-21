
# WARNING - DO NOT USE FOR PRODUCTION

## What this program use for?

This program helping you for caching the API request for offline usage. The data from API will be kept updating during your daily development activities.  
The snapshot will keep being recorded. You can commit the snapshot to your code repository.

Suppose your teammate fetch new code, she can run the application while not having a dev api server running on her end. She can still doing the Frontend UI development with the api snapshots recorded.

### Some usecases:
* Your API not allow CORS request. You want to use the api on your beloved localhost:3000. This program allow to override the CORS header on your localhost frontend.

* You are fullstack developer. You can do server api and frontend. But your teammate who have strong skill on UI frontend, she can do the update on the frontend more easily and effeciently than you.   
But running the api server on her end is quite complex for her, install docker, install postgres, mysql, redis etc... geee. It is quite overwhelming for her to get through that to helping your integrate the api to frontend.  
Then you can use this program, setup the query api on the frontend, let the program recording your api response. Your teammate, can get the snapshot and run the snapshot api on her end. She can then focus on delivering stunnig frontend with api integrated.


## Quick start

Run by command:
* ```# reproxii --target="https://example.com" --port=8002```


