package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	dir := flag.String("dir", ".", "Directory to serve")
	port := flag.String("port", "8080", "Port to run server on")
	flag.Parse()

	absDir, err := filepath.Abs(*dir)
	if err != nil {
		log.Fatal(err)
	}

	info, err := os.Stat(absDir)
	if err != nil || !info.IsDir() {
		log.Fatalf("Invalid directory: %s", absDir)
	}

	fs := http.FileServer(http.Dir(absDir))
	http.Handle("/", fs)

	fmt.Printf("Serving %s at http://localhost:%s\n", absDir, *port)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}
