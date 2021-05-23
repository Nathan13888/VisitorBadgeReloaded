.DEFAULT_GOAL := run

run:
	go run .

bench:
	go run ./benchmark/bench.go

build:
	go build -ldflags "-s -w" -o bin/vbr .

docker-build:
	docker build -t vbr .

docker-run:
	docker run -it --rm -p 80:8080 -p 443:8081 vbr

publish:
	make publish-ghcr

publish-ghcr:
	make docker-build
	# TODO: specify tag version
	docker tag vbr:latest docker.pkg.github.com/nathan13888/visitorbadgereloaded/vbr:latest
	docker push docker.pkg.github.com/nathan13888/visitorbadgereloaded/vbr:latest

pull-ghcr:
	docker pull docker.pkg.github.com/nathan13888/visitorbadgereloaded/vbr:latest

deploy-heroku:
	# TODO: set scaling settings, check heroku branch exists
	git push heroku master
