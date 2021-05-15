.DEFAULT_GOAL := run

run:
	go run .

bench:
	go run ./benchmark/bench.go

build:
	go build -ldflags "-s -w" -o server .

docker-build:
	docker build -t vbr .

docker-run:
	docker run -it --rm -p 80:8080 -p 443:8081 vbr

deploy-heroku:
	# TODO: set scaling settings, check heroku branch exists
	git push heroku master
