-- Insert script directly from parsed JSON

-- Script data
\set script_id '''adf12345-6789-abcd-ef01-234567890abc'''
\set user_id '''e6f1aeee-b6ab-426f-aa12-e15ab8f3a6da'''
\set script_title '''test'''

BEGIN;

-- Insert script
INSERT INTO scripts (id, title, created_by, created_at, is_public)
VALUES (:script_id::uuid, :script_title, :user_id::uuid, NOW(), false);

-- Insert blocks for PROLOG section
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title) VALUES
(gen_random_uuid(), :script_id::uuid, 'scene-block', '{"type": "scene"}'::jsonb, NOW(), 0, 1, '1', 'PROLOG'),
(gen_random_uuid(), :script_id::uuid, 'stage_direction', '{"type": "stage_direction", "line": "(Stimme vom Band)"}'::jsonb, NOW(), 1, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Who am I?"}'::jsonb, NOW(), 2, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am in a strange state of mind."}'::jsonb, NOW(), 3, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am alone"}'::jsonb, NOW(), 4, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "quite alone"}'::jsonb, NOW(), 5, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "in the world"}'::jsonb, NOW(), 6, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "who is the other of my thoughts?"}'::jsonb, NOW(), 7, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I know that I am about"}'::jsonb, NOW(), 8, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "to die /to be born"}'::jsonb, NOW(), 9, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "and I feel happy"}'::jsonb, NOW(), 10, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "joyous"}'::jsonb, NOW(), 11, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I feel my pulse; it beats fast:"}'::jsonb, NOW(), 12, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I place my thin hand on my cheek; it burns:"}'::jsonb, NOW(), 13, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "there is a slight, quick spirit within me which is now"}'::jsonb, NOW(), 14, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "emitting its first"}'::jsonb, NOW(), 15, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "its last sparks"}'::jsonb, NOW(), 16, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "a feeling that I cannot define leads me on"}'::jsonb, NOW(), 17, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am a creature"}'::jsonb, NOW(), 18, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "and I am too weak both in body and mind to resist the slightest impulse"}'::jsonb, NOW(), 19, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "the impulse to create"}'::jsonb, NOW(), 20, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "the impulse to destroy"}'::jsonb, NOW(), 21, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I may tread a land never before imprinted by the foot of man"}'::jsonb, NOW(), 22, 1, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I must collect my thoughts"}'::jsonb, NOW(), 23, 1, NULL, NULL);

-- Add more blocks from page 2
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title) VALUES
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "there is something at work in my soul that I do not understand"}'::jsonb, NOW(), 24, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Am I not alone?"}'::jsonb, NOW(), 25, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I must pursue and destroy the being to whom I gave existence"}'::jsonb, NOW(), 26, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "then my lot on earth will be fulfilled and I may die"}'::jsonb, NOW(), 27, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I walk a little offroad"}'::jsonb, NOW(), 28, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Old borders collapse"}'::jsonb, NOW(), 29, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "new ones are being drawn"}'::jsonb, NOW(), 30, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Dangerous"}'::jsonb, NOW(), 31, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Liberating"}'::jsonb, NOW(), 32, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Where is the ultimate border?"}'::jsonb, NOW(), 33, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "\"A little patience, and all will be over.\""}'::jsonb, NOW(), 34, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Who am I?"}'::jsonb, NOW(), 35, 2, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'stage_direction', '{"type": "stage_direction", "line": "dt. Übersetzung"}'::jsonb, NOW(), 36, 2, NULL, NULL);

-- Add scene 2 blocks
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title) VALUES
(gen_random_uuid(), :script_id::uuid, 'scene-block', '{"type": "scene"}'::jsonb, NOW(), 100, 4, '2', 'DER TOD, MARY ERFINDET EINE SCHAUERGESCHICHTE'),
(gen_random_uuid(), :script_id::uuid, 'stage_direction', '{"type": "stage_direction", "line": "Maren, Felix und Alexander in der Ur-Form/Homo Sapiens"}'::jsonb, NOW(), 101, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Menschen sterben. Der Tod ist ein zu schrecklicher Gegenstand. Menschen vertragen nicht sehr viel Realität. Deshalb erfinden wir Geschichten."}'::jsonb, NOW(), 102, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Und was, wenn wir die Geschichten sind, die wir erfinden?"}'::jsonb, NOW(), 103, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Schon als Kind war es meine Lieblingsbeschäftigung, in den Stunden, die ich mir selbst überlassen war, Geschichten zu erzählen. Doch ich machte mich nicht zur Heldin meiner Geschichte(n). Ich war nicht auf meine eigene Identität angewiesen und konnte die Stunden mit Schöpfungen bevölkern, die viel interessanter für mich waren als meine eigenen Empfindungen. -"}'::jsonb, NOW(), 104, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Verdiene ich es nicht, Großes zu vollbringen?"}'::jsonb, NOW(), 105, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Meine Stimmungen und meine Leidenschaften sind zuweilen heftig."}'::jsonb, NOW(), 106, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Aber durch irgendein inneres Gesetz meines Wesens werden sie umgewandelt in den unbedingten Wunsch zu lernen."}'::jsonb, NOW(), 107, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'joint_dialogue', '{"type": "joint_dialogue", "speakers": ["ALEXANDER", "MAREN"], "line": "Meine Mutter starb friedlich."}'::jsonb, NOW(), 108, 4, NULL, NULL),
(gen_random_uuid(), :script_id::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "A little patience and it will all be over."}'::jsonb, NOW(), 109, 4, NULL, NULL);

COMMIT;

SELECT 'Script created with ID: ' || :script_id AS result;