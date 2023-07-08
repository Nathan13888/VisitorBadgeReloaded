.DEFAULT_GOAL := run

run:
	PORT=8080 DEBUG=ENABLED LOCAL_SHIELDS=ENABLED go run .

bench:
	go run ./benchmark/bench.go

build:
	go build -ldflags "-s -w" -o bin/vbr .

docker-build:
	docker build \
		--label "org.opencontainers.image.source=https://github.com/Nathan13888/VisitorBadgeReloaded" \
		-t vbr .
	# TODO: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#labelling-container-images

docker-run:
	docker run -it --rm -p 80:8080 -p 443:8081 -p 9090:9090 vbr

docker-debug:
	docker run -it --rm -p 80:8080 -p 443:8081 -p 9090:9090 --entrypoint bash vbr

publish:
	make docker-build
	make publish-ghcr

publish-ghcr:
	# TODO: specify tag version
	docker tag vbr:latest ghcr.io/nathan13888/vbr:latest
	docker push ghcr.io/nathan13888/vbr:latest

pull-ghcr:
	docker pull docker.pkg.github.com/nathan13888/visitorbadgereloaded/vbr:latest

deploy-heroku:
	# TODO: set scaling settings, check heroku branch exists
	git push heroku master

