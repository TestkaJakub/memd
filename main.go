package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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

	http.HandleFunc("/api/files", handleFiles(absDir))
	http.HandleFunc("/api/file", handleFile(absDir))
	http.Handle("/", http.FileServer(http.Dir("./static")))

	fmt.Printf("Serving %s at http://localhost:%s\n", absDir, *port)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}

func safeHeaders(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
}

func isSubPath(parent, child string) bool {
	parent = filepath.Clean(parent) + string(os.PathSeparator)
	child = filepath.Clean(child)
	return strings.HasPrefix(child+string(os.PathSeparator), parent)
}

func handleFiles(notesDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		safeHeaders(w)

		var files []string

		err := filepath.WalkDir(notesDir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !d.IsDir() && strings.HasSuffix(d.Name(), ".md") {
				rel, err := filepath.Rel(notesDir, path)
				if err != nil {
					return err
				}
				files = append(files, rel)
			}
			return nil
		})

		if err != nil {
			http.Error(w, "Cannot read directory", http.StatusInternalServerError)
			return
		}

		if files == nil {
			files = []string{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	}
}

func handleFile(notesDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		safeHeaders(w)

		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "Missing name parameter", http.StatusBadRequest)
			return
		}

		clean := filepath.Join(notesDir, filepath.Clean("/"+name))
		if !isSubPath(notesDir, clean) {
			http.Error(w, "Invalid path", http.StatusForbidden)
			return
		}

		content, err := os.ReadFile(clean)
		if err != nil {
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write(content)
	}
}
