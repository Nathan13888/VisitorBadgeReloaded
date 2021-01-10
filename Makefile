run:
	go run server.go

build:
	go build -o server . 

docker-build:
	docker build -t vbr .

docker-run:
	docker run -it --rm -p 80:8080 -p 443:8081 vbr