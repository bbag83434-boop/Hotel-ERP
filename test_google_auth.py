
import requests
url = "http://localhost:10000/api/v1/auth/google"
data = {"id_token": "a_very_long_test_token_string_that_is_long_enough"}
response = requests.post(url, json=data)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
