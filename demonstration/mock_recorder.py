import time
import sys

print("SIMULATING BACKGROUND SCREEN RECORDER...")
print("This is a harmless mock program for cybersecurity demonstration purposes.")
print("Press Ctrl+C to terminate.")

try:
    while True:
        # Keep the process alive in the background
        time.sleep(2)
except KeyboardInterrupt:
    print("\nMock screen recorder terminated by user.")
    sys.exit(0)
