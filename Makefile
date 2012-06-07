# Proxibase make file for helping people find the tests

all: hello

hello:
	@echo 'usage: make <test|test-basic|test-all>'

test: test-basic

test-basic:
	node test/run --basic

test-all:
	node test/run

.PHONY: test test-basic test-all
