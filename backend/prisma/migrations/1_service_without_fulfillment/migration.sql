-- Jasa tidak memiliki metode penyerahan. Kosongkan metode penyerahan pada listing jasa yang sudah ada.
UPDATE "listings"
SET "fulfillmentMethods" = ARRAY[]::"FulfillmentMethod"[]
WHERE "mode" = 'SERVICE';
