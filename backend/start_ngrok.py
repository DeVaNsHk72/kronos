import ngrok, time

listener = ngrok.forward(8000, authtoken_from_env=True)
print(f"\n✅ Public URL: {listener.url()}")
print(f"\nRegister webhook: http://localhost:8000/telegram/set-webhook?url={listener.url()}")
print("\nPress Ctrl+C to stop\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    ngrok.disconnect()
