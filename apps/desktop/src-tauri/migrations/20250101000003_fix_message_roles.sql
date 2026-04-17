UPDATE messages
SET role = substr(role, 2, length(role) - 2)
WHERE role IN ('"system"', '"user"', '"assistant"', '"tool"');
