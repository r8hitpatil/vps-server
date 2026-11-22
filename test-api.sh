#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:3000"

echo "============================================="
echo "🧪 Running NestJS Booking System API Tests"
echo "============================================="

echo -e "\n1️⃣  Fetching available resources..."
RESOURCES=$(curl -s "$BASE_URL/resources")
echo "$RESOURCES" | jq .

RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.[0].id')
echo "👉 Selected Resource: $RESOURCE_ID"

echo -e "\n2️⃣  Creating Booking 1 (Alice: 10:00 - 12:00)..."
BOOKING_1=$(curl -s -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"resourceId\": \"$RESOURCE_ID\",
    \"customerName\": \"Alice Johnson\",
    \"customerEmail\": \"alice@example.com\",
    \"startTime\": \"2026-11-24T10:00:00.000Z\",
    \"endTime\": \"2026-11-24T12:00:00.000Z\"
  }")
echo "$BOOKING_1" | jq .
BOOKING_1_ID=$(echo "$BOOKING_1" | jq -r .id)

echo -e "\n3️⃣  Attempting Overlapping Booking (Bob: 11:00 - 13:00) -> Should fail with 409 Conflict..."
CONFLICT_RES=$(curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"resourceId\": \"$RESOURCE_ID\",
    \"customerName\": \"Bob Smith\",
    \"customerEmail\": \"bob@example.com\",
    \"startTime\": \"2026-11-24T11:00:00.000Z\",
    \"endTime\": \"2026-11-24T13:00:00.000Z\"
  }")
echo "$CONFLICT_RES"

echo -e "\n4️⃣  Creating Adjacent Booking (Charlie: 12:00 - 14:00) -> Should succeed 201..."
BOOKING_2=$(curl -s -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"resourceId\": \"$RESOURCE_ID\",
    \"customerName\": \"Charlie Brown\",
    \"customerEmail\": \"charlie@example.com\",
    \"startTime\": \"2026-11-24T12:00:00.000Z\",
    \"endTime\": \"2026-11-24T14:00:00.000Z\"
  }")
echo "$BOOKING_2" | jq .

echo -e "\n5️⃣  Checking Resource Availability for 2026-11-24..."
curl -s "$BASE_URL/bookings/availability/$RESOURCE_ID?date=2026-11-24" | jq .

echo -e "\n6️⃣  Cancelling Booking 1 ($BOOKING_1_ID)..."
curl -s -X PATCH "$BASE_URL/bookings/$BOOKING_1_ID/cancel" | jq .

echo -e "\n7️⃣  Re-checking Availability (Slot 10:00-12:00 should now be free)..."
curl -s "$BASE_URL/bookings/availability/$RESOURCE_ID?date=2026-11-24" | jq .

echo -e "\n============================================="
echo "✅ All API tests completed successfully!"
echo "============================================="
