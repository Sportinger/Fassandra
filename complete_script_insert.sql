
BEGIN;

-- Insert script
INSERT INTO scripts (id, title, created_by, created_at, is_public)
VALUES ('7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'test', 'e6f1aeee-b6ab-426f-aa12-e15ab8f3a6da'::uuid, NOW(), false);

-- Insert all blocks

INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7185a7ac-d142-4795-892a-dc0df7a32ead'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'scene-block', '{"type": "scene"}'::jsonb, NOW(), 0, 1, '1', 'PROLOG');
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('62960231-3fab-45e9-b846-ff92206c5365'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'stage_direction', '{"type": "stage_direction", "line": "(Stimme vom Band)"}'::jsonb, NOW(), 1, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('acd281af-ed58-45e8-ae22-5bf0e3bf8b54'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Who am I?"}'::jsonb, NOW(), 2, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('eb5e0f78-c9f6-4051-83e9-3ee1c63fd37f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am in a strange state of mind."}'::jsonb, NOW(), 3, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('6215f6ff-a09e-4983-a4ff-87a2058d83e3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am alone"}'::jsonb, NOW(), 4, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4fd5978b-800e-4969-be53-c704f2792a53'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "quite alone"}'::jsonb, NOW(), 5, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7ea5c8c3-4438-40a9-8f83-9aed1172bf08'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "in the world"}'::jsonb, NOW(), 6, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('55ac995b-af9b-4414-ab7a-c65532746853'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "who is the other of my thoughts?"}'::jsonb, NOW(), 7, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('730907a3-7193-4e32-8fa3-36c2a4a36ea7'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I know that I am about"}'::jsonb, NOW(), 8, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e60fff19-93c0-4e62-809a-50cec8c6f799'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "to die /to be born"}'::jsonb, NOW(), 9, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('a900adf1-171a-44e1-8e18-802dd7281063'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "and I feel happy"}'::jsonb, NOW(), 10, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3c42695a-756e-4bf0-a5b7-d2eb5604cdf2'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "joyous"}'::jsonb, NOW(), 11, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('a2b2f641-9eb9-4ef2-b7b8-ec890f8f1d95'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I feel my pulse; it beats fast:"}'::jsonb, NOW(), 12, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('04688c67-8e13-4e39-b9b9-6a27b7a53e68'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I place my thin hand on my cheek; it burns:"}'::jsonb, NOW(), 13, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('00c202f7-6a0c-4d0f-a500-633bc5ce27eb'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "there is a slight, quick spirit within me which is now"}'::jsonb, NOW(), 14, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('1d0f1720-7cef-4c52-8caa-080bdd1a1650'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "emitting its first"}'::jsonb, NOW(), 15, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e427dbac-e25c-40ff-b072-8e0b352243d0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "its last sparks"}'::jsonb, NOW(), 16, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('cbe68293-a68c-407b-a7d2-c68fc56ff449'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "a feeling that I cannot define leads me on"}'::jsonb, NOW(), 17, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0c97f64f-3425-4760-adec-f39c73f31b57'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I am a creature"}'::jsonb, NOW(), 18, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8761d1aa-c0c9-4248-9a5d-83edb7f903a0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "and I am too weak both in body and mind to resist the slightest impulse"}'::jsonb, NOW(), 19, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c6096c78-4770-4c22-9e19-d011bdbb138a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "the impulse to create"}'::jsonb, NOW(), 20, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('78d2fd0c-edd0-4019-8722-42f5d85f490d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "the impulse to destroy"}'::jsonb, NOW(), 21, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('9196b1ec-ca86-432e-a612-ef1648edb86c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I may tread a land never before imprinted by the foot of man"}'::jsonb, NOW(), 22, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('6a2ebc26-5d84-41b0-93db-8e9634b43d78'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I must collect my thoughts"}'::jsonb, NOW(), 23, 1, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c439e5a6-ccf3-4535-97cf-4b5281b8f22d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "there is something at work in my soul that I do not understand"}'::jsonb, NOW(), 24, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3b4f704d-0d88-412f-85e1-1b67badc734b'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Am I not alone?"}'::jsonb, NOW(), 25, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('96b45ab6-864f-4682-a3f1-82c85bba61cf'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I must pursue and destroy the being to whom I gave existence"}'::jsonb, NOW(), 26, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b3b436ac-0a52-43bc-983a-14d909487c3b'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "then my lot on earth will be fulfilled and I may die"}'::jsonb, NOW(), 27, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e354f1a7-7978-42a5-8410-d49f0ca6abbd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I walk a little offroad"}'::jsonb, NOW(), 28, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('60374360-7367-4120-8bc2-ef01f84948c1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Old borders collapse"}'::jsonb, NOW(), 29, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8b18e68a-7d06-4342-ac49-9bb054b2a203'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "new ones are being drawn"}'::jsonb, NOW(), 30, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8a2fa101-f693-491b-b69c-1367465b3cb3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Dangerous"}'::jsonb, NOW(), 31, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('bae7bc3a-bbff-4a7f-b812-8634822a86f1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Liberating"}'::jsonb, NOW(), 32, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('54ed6228-a519-4ba6-9e53-f847bb0ca5fd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Where is the ultimate border?"}'::jsonb, NOW(), 33, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('595d9e06-b792-4e52-ad5a-0b23d8d6b3b1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "\"A little patience, and all will be over.\""}'::jsonb, NOW(), 34, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ca4d31bc-9447-43e5-a6f1-02d314ed4c39'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Who am I?"}'::jsonb, NOW(), 35, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('88fcdaeb-a2a4-4fa6-bfae-34cb196aaeb1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'stage_direction', '{"type": "stage_direction", "line": "dt. \u00dcbersetzung"}'::jsonb, NOW(), 36, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('f9484b85-ec3f-489f-b92f-ccc6f6dc0af9'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Wer bin ich?"}'::jsonb, NOW(), 37, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b9f7dc78-5df0-4e90-8f73-389cffde5f4a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich bin in einer merkw\u00fcrdigen Gem\u00fctsverfassung"}'::jsonb, NOW(), 38, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('5e2e3ab5-b7a5-4af2-82b9-06bde99a6d85'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich bin allein"}'::jsonb, NOW(), 39, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('65682aea-82ce-406e-855d-d4e066d09812'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ziemlich allein"}'::jsonb, NOW(), 40, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e1ae02eb-7132-4bed-9e8e-cedf5c4017f3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "In der Welt"}'::jsonb, NOW(), 41, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('32e5cd99-5879-432d-954f-6fa62c20a56f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "wer ist der Autor meiner Gedanken"}'::jsonb, NOW(), 42, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c3bde8ad-f0cd-4b34-aca4-ed757f58d9e7'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich wei\u00df ich bin kurz davor"}'::jsonb, NOW(), 43, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3744bad1-fc25-4f21-bfc0-37739d8592cc'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "zu sterben"}'::jsonb, NOW(), 44, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('337af4d4-e7d2-4a23-b94f-371dbd6e0d6f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "geboren zu werden"}'::jsonb, NOW(), 45, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('343273bc-1b32-496f-a1eb-d6a687295b18'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "und ich bin gl\u00fccklich"}'::jsonb, NOW(), 46, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('bca5142d-ebd5-4aed-82d2-ef6aed63cf82'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "fr\u00f6hlich"}'::jsonb, NOW(), 47, 2, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('65449f62-d7a4-4f8a-916c-63e7d425dc8c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich f\u00fchle meinen Puls; er schl\u00e4gt schnell"}'::jsonb, NOW(), 48, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('70eec035-3a47-46fd-b4f3-1b56e706e4f0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich lege meine d\u00fcnne Hand auf meine Wange; sie brennt"}'::jsonb, NOW(), 49, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('330d0734-635d-4d61-9acd-2e095bf6507f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Da ist ein leichter, fl\u00fcchtiger Geist in mir, der seine"}'::jsonb, NOW(), 50, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('aa3df652-9ac8-4717-b56b-2c6646358476'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "ersten Strahlen aussendet"}'::jsonb, NOW(), 51, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7a1cc955-1652-4e8f-ae9e-fe5e91221845'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "seine letzten"}'::jsonb, NOW(), 52, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c57a58be-9e0e-4360-828e-0b1061b9f952'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ein Gef\u00fchl, das ich nicht definieren kann, leitet mich"}'::jsonb, NOW(), 53, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e3b6c44c-9d64-4462-a5ff-eba740e8ef73'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "und ich bin k\u00f6rperlich und geistig zu schwach, um dem geringsten Impuls zu widerstehen"}'::jsonb, NOW(), 54, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0f0b88b0-cb1f-4a20-aa31-668e83b2fcd4'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "dem Impuls zu erschaffen"}'::jsonb, NOW(), 55, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ce0d871d-f5d9-4437-8046-f3f3a72b1396'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "dem Impuls zu zerst\u00f6ren"}'::jsonb, NOW(), 56, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('fa85e842-0cab-44eb-a9f9-94a63eef6cf0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "ich werde meinen Fu\u00df auf ein Land setzen, das vor mir noch nie jemand betreten hat"}'::jsonb, NOW(), 57, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('749a47d5-8be9-4f85-81da-535910d9dcb4'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich muss meine Gedanken ordnen"}'::jsonb, NOW(), 58, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e825ac84-131c-4b08-ab00-7412e74e235f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "irgendetwas, das ich nicht verstehe, arbeitet in meiner Seele"}'::jsonb, NOW(), 59, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('18e5a9c9-dab8-4341-83e4-58c2702083d3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Bin ich nicht allein?"}'::jsonb, NOW(), 60, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('f5fa73fb-130b-477f-a44c-6610f9fb279d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Ich muss das Wesen, dem ich seine Existenz geschenkt habe, verfolgen und zerst\u00f6ren"}'::jsonb, NOW(), 61, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e85a3329-8e8f-4d3f-9591-bdc7fb244a02'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Dann wird mein Schicksal auf Erden erf\u00fcllt sein und ich kann sterben"}'::jsonb, NOW(), 62, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4fcb3b04-7f90-4b9e-9672-d04894fb9e2a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "I walk a little offroad"}'::jsonb, NOW(), 63, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('62b72579-cbd8-4226-b663-7d1bdff6e3f7'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Old borders collapse"}'::jsonb, NOW(), 64, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('63c1b590-a526-48e1-9f26-fe6af257471a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "new ones are being drawn"}'::jsonb, NOW(), 65, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c18590b5-0d45-424b-b505-ff11505bf8bf'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Dangerous"}'::jsonb, NOW(), 66, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('f86467b5-9cca-4b95-937a-94042d594340'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Liberating"}'::jsonb, NOW(), 67, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4791c4a6-b02a-42f5-80e6-2719f89653cf'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALLE", "line": "Wo ist die ultimative Grenze?"}'::jsonb, NOW(), 68, 3, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b91f9903-8e54-420e-ac4a-1586a6ab1103'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'scene-block', '{"type": "scene"}'::jsonb, NOW(), 69, 4, '2', 'DER TOD, MARY ERFINDET EINE SCHAUERGESCHICHTE');
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b3cef262-b238-40f1-8731-c8e089cd17c7'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'stage_direction', '{"type": "stage_direction", "line": "Maren, Felix und Alexander in der Ur-Form/Homo Sapiens"}'::jsonb, NOW(), 70, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('541c0e07-6527-4acc-bcf3-fc3917dd3cf1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Menschen sterben. Der Tod ist ein zu schrecklicher Gegenstand. Menschen vertragen nicht sehr viel Realit\u00e4t. Deshalb erfinden wir Geschichten."}'::jsonb, NOW(), 71, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8c542606-6972-48cd-b143-6a27470a95b0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Und was, wenn wir die Geschichten sind, die wir erfinden?"}'::jsonb, NOW(), 72, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('cd86673c-3f64-412a-bd48-34ed8692a2c4'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Schon als Kind war es meine Lieblingsbesch\u00e4ftigung, in den Stunden, die ich mir selbst \u00fcberlassen war, Geschichten zu erz\u00e4hlen. Doch ich machte mich nicht zur Heldin meiner Geschichte(n). Ich war nicht auf meine eigene Identit\u00e4t angewiesen und konnte die Stunden mit Sch\u00f6pfungen bev\u00f6lkern, die viel interessanter f\u00fcr mich waren als meine eigenen Empfindungen. -"}'::jsonb, NOW(), 73, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ff0f99d4-fdab-4cab-900a-1bf820053c17'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Verdiene ich es nicht, Gro\u00dfes zu vollbringen?"}'::jsonb, NOW(), 74, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8f96d779-1678-40b2-a078-e7f0f8a2d514'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Meine Stimmungen und meine Leidenschaften sind zuweilen heftig."}'::jsonb, NOW(), 75, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('01800535-5ae3-4e9f-83b6-c8f400eca712'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Aber durch irgendein inneres Gesetz meines Wesens werden sie umgewandelt in den unbedingten Wunsch zu lernen."}'::jsonb, NOW(), 76, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('6a233c02-b558-4e36-bb38-359052987820'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Diese Geschichte kann als die Erfahrung gelesen werden, diese Geschichte zu erz\u00e4hlen"}'::jsonb, NOW(), 77, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('74647b58-90eb-4bd5-8d8d-eb58ad48e2c6'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Es sind die Geheimnisse des Himmels und der Erde, die ich ergr\u00fcnden will."}'::jsonb, NOW(), 78, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('201c6f39-34dd-4f83-ba4f-5b1b3985d6cd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Woraus geht das Prinzip des Lebens hervor?"}'::jsonb, NOW(), 79, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('90955476-0897-4753-9be9-d5e03af02938'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Um die Ursache des Lebens zu untersuchen, m\u00fcssen wir uns erst mit dem Tod besch\u00e4ftigen."}'::jsonb, NOW(), 80, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0f7acfe1-beec-4f76-9bb4-c2cea0c4d506'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'joint_dialogue', '{"type": "joint_dialogue", "speakers": ["ALEXANDER", "MAREN"], "line": "Meine Mutter starb friedlich."}'::jsonb, NOW(), 81, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('bb06c9c9-d246-4b83-a4f2-8f414b976e0d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "A little patience and it will all be over."}'::jsonb, NOW(), 82, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('dd41fbde-544e-497b-b6f8-eb4b5fe897a2'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Und selbst im Tod sprach noch Liebe aus ihren Z\u00fcgen."}'::jsonb, NOW(), 83, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7910b494-b7f1-48ca-a437-2fce54a5f6d9'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "The memory of my mother has always been the pride and delight of my life. Sie starb bei meiner Geburt. Ich lernte lesen mit meinem Finger auf der Inschrift ihres Grabes."}'::jsonb, NOW(), 84, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7794d088-c8c7-4e12-9d0f-21ceb6256d97'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "F\u00fcr meinen Vater war sie die Gr\u00f6\u00dfte."}'::jsonb, NOW(), 85, 4, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('a24393dd-d320-468f-9e3e-02aea3c742ef'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Und nach ihrem Tod setzte er seine Hoffnung in mich. Ich bin Mary, die Namensvetterin meiner Mutter, der gro\u00dfen Frauenrechtlerin und das Namenssouvenir meines Vaters."}'::jsonb, NOW(), 86, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8edb3da1-3fe5-463a-a0de-1df084da23b1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Ich brauche das Gef\u00fchl nicht zu beschreiben."}'::jsonb, NOW(), 87, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ce0c5290-2df7-4967-9a37-f3b218da4158'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Das Gef\u00fchl derer, deren liebste Bindungen von \u2026"}'::jsonb, NOW(), 88, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c599d9dd-dd62-4502-909e-ccb28eb824de'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "- dem irreparabelsten aller \u00dcbel zerrissen werden."}'::jsonb, NOW(), 89, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('2c526ca5-a94b-4daf-93bf-d20082c8bb7f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Die Leere, die sich der Seele offenbart."}'::jsonb, NOW(), 90, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('dd9b94e5-ed37-4c60-a255-1c0091a9d0bd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Die Verzweiflung, die sich auf dem Gesicht zeigt."}'::jsonb, NOW(), 91, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e2192a59-24c0-4397-8862-20121234619b'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Trauer ist das Gef\u00fchl mit jemandem zu leben, der nicht mehr da ist."}'::jsonb, NOW(), 92, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('1a984c57-8ead-4ed1-aeca-f5a3cb22ab93'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Glaubst du an Geister?"}'::jsonb, NOW(), 93, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('93a71a79-0d0f-4e93-8b8d-f9ba6b845a2c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Wie k\u00f6nnte der K\u00f6rper Herr \u00fcber den Geist sein? Unser Mut, unsere Heldenhaftigkeit, selbst unser Hass, alles was wir tun, um die Welt zu formen, ist das der K\u00f6rper oder der Geist?"}'::jsonb, NOW(), 94, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0afb55ea-57e2-44de-953f-a3b820404e0f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Es ist der Geist."}'::jsonb, NOW(), 95, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('18eb4046-f8b5-4443-b10f-01d706d980e9'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Von meiner Sch\u00f6pfung und meinem Sch\u00f6pfer wusste ich absolut nichts."}'::jsonb, NOW(), 96, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('2899982d-a9d4-481c-b36f-c19d02702789'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "War ich ein Monster?"}'::jsonb, NOW(), 97, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('354df3c3-f076-444d-8c45-de132a35b2f0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Ich fing an, B\u00fccher zu lesen;"}'::jsonb, NOW(), 98, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0b79c932-5e8d-40bf-9937-b938d4aa66db'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "-mich mehr mit den Gedanken anderer zu identifizieren; meine Individualit\u00e4t in der Menge derer zu verlieren, die vor mir existiert hatten."}'::jsonb, NOW(), 99, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('755641e8-a287-4009-9e25-64be96cd38bf'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Aber mein Kummer nahm mit dem Wissen zu."}'::jsonb, NOW(), 100, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c6863ca5-c379-4b55-a9e4-efd0c656085c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Oh, w\u00e4ren die Menschen f\u00fcr immer in ihren heimischen W\u00e4ldern geblieben! Oh, h\u00e4tten wir nichts anderes gekannt au\u00dfer dem Gef\u00fchl von Hunger, Durst und Hitze. Von welch seltsamer Natur Wissen ist."}'::jsonb, NOW(), 101, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('bc4e17c2-46ab-438a-8416-423422cbcb92'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Wenn es einem Menschen je gel\u00e4nge, einen Toten wiederzubeleben, durch Galvanismus oder sonst eine bislang unentdeckte Methode, w\u00fcrde der Geist dann zur\u00fcckkehren?"}'::jsonb, NOW(), 102, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('f33b97ef-3bcd-42d3-a8ff-35877e47d3a1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Wieso sollte der Geist in ein ruiniertes Haus zur\u00fcckkehren?"}'::jsonb, NOW(), 103, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ff37bb51-4914-47ca-b4ce-281bba5781de'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Nichts tr\u00e4gt so sehr zur Beruhigung des Geistes bei wie ein beharrlich verfolgtes Ziel."}'::jsonb, NOW(), 104, 5, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c5a2cd64-111f-4e43-8d22-90ae528a019a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Ein Fixpunkt, auf den die Seele ihr geistiges Auge richten kann."}'::jsonb, NOW(), 105, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('9c634e50-8025-4f6e-8cb4-4110c332b397'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "\"Hast Du Dir schon eine Geschichte ausgedacht, Mary?\" fragte Byron. Nichts kommt, wenn es gerufen wird - man muss dem\u00fctig zugeben, dass das Neue nicht aus dem Nichts kreiert wird."}'::jsonb, NOW(), 106, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c87ff02c-1951-4054-8637-70b7a487517b'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Sondern aus dem Chaos."}'::jsonb, NOW(), 107, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('31bddb62-3383-47d9-b791-4dc53703f9f0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Es war das Jahr ohne Sommer, eine Naturkatastrophe verdunkelte die Welt."}'::jsonb, NOW(), 108, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3943e5fa-e473-4825-b036-31e76b7003e9'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Ich werde meine Wissensgier befriedigen und meinen Fu\u00df auf ein Land setzen, dass vor mir noch niemand betreten hat."}'::jsonb, NOW(), 109, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('94f69620-6c23-42a2-bfce-bc40f771ba70'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Was w\u00fcrde dich am meisten \u00e4ngstigen?"}'::jsonb, NOW(), 110, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('d282cff9-5c58-452a-99ac-967f1984852b'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Ewiges Leben. Diese Verlockung reicht aus, um all meine Furcht vor Gefahr und Tod zu besiegen."}'::jsonb, NOW(), 111, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('330fc0bf-0321-4a05-b7f6-14ef30e8b811'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Nein, ich m\u00f6chte nicht ewig leben, das Leben ist schon qu\u00e4lend genug."}'::jsonb, NOW(), 112, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('09ca8ab8-f470-4e27-90f7-c40b5433589c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Was ich will, existiert, wenn ich wage, es zu finden."}'::jsonb, NOW(), 113, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('1c1680a2-f107-4c1d-855b-bd63fb876a13'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Everything you can think of is true."}'::jsonb, NOW(), 114, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3cd5965d-3505-47b0-ae0a-25809cf8645c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Ich erz\u00e4hle eine Geschichte. Eine Geschichte, die macht, dass es dem Leser davor graut, sich umzublicken, die das Blut gerinnen l\u00e4sst und die Schl\u00e4ge des Herzens beschleunigt."}'::jsonb, NOW(), 115, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8879866a-0e0e-4fa0-bd19-20875bb79917'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Es gen\u00fcgt nicht, die Natur und die Wahrheit zu erforschen. Man muss auch den Mut haben, davon zu erz\u00e4hlen."}'::jsonb, NOW(), 116, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('a2ff1c2e-dde4-4b66-be00-db7c0eeef722'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Benennen bedeutet Macht."}'::jsonb, NOW(), 117, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('f08d9492-c186-4364-8867-786ac8a3330f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Wer Dinge falsch benennt, tr\u00e4gt zum Unheil der Welt bei."}'::jsonb, NOW(), 118, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('95fdbc1d-f8cd-4ab5-bf9a-53783c7b97ce'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Eine Geschichte, die unsere geheimnisvollen, menschlichen Ur\u00e4ngste anspricht und tiefes Entsetzen weckt. Einerseits dient das Gedankenspiel der Unterhaltung, andererseits tr\u00e4gt es dazu bei, in unerforschte Regionen des Geistes vorzudringen."}'::jsonb, NOW(), 119, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('65f44e87-22f9-4e39-90a6-acdff03a5d3a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Jede Sache muss einen Anfang haben. Und dieser Anfang muss mit etwas verbunden sein, das davor geschah."}'::jsonb, NOW(), 120, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7ed3a70c-2179-4397-a2ed-f1dbc3b4767c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Unser erstes Kind starb kurz nach seiner Geburt. Der Tod ist nat\u00fcrlich. Verfall unumg\u00e4nglich. Ich bin den Tod gew\u00f6hnt, und ich hasse ihn. Es gibt kein neues Leben ohne Tod. Es kann keinen Tod geben, solange es kein Leben gibt. Kein Leben ohne"}'::jsonb, NOW(), 121, 6, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b6c9e580-3468-49f6-acc4-d7693411924d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Tod, kein Tod ohne Leben, kein\u2026"}'::jsonb, NOW(), 122, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('2a3d1eda-a392-4cac-a615-b5b7575ab3dd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Kann ich sterben?"}'::jsonb, NOW(), 123, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('6a98767e-25c9-48ce-89f7-ebd61bb628b0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Das Wesen der Sterblichkeit und Endlichkeit und das Wesen der Sprache verschw\u00f6ren sich immer wieder, um uns zum Stottern zu bringen."}'::jsonb, NOW(), 124, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('a8f47bca-ddc0-49de-86d3-e2edf00e8556'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Man kann niemals das haben, worauf man nicht verzichten kann."}'::jsonb, NOW(), 125, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('3b989e16-39b0-4a60-8c3d-a013b4a33672'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Man stolpert immer genau dann, wenn man glaubt, am Ziel zu sein."}'::jsonb, NOW(), 126, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('8f059329-10e1-4849-ae7e-f0e6b3f223dd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Meiner Geschichte wegen habe ich den Wunsch herauszufinden, was uns Menschen vom Rest des biologischen Lebens unterscheidet."}'::jsonb, NOW(), 127, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7fd2e449-d904-4ea6-8542-92763b3781f1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Und was von Maschinen."}'::jsonb, NOW(), 128, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4d5b0111-35b9-4de0-8487-b06e23473e72'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "So vieles wurde bereits erreicht\u2026"}'::jsonb, NOW(), 129, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b586a98c-dc68-40fc-a45a-5aadbad1efe1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "\u2026 rief die Seele Frankensteins aus \u2013"}'::jsonb, NOW(), 130, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4f44f9b1-748a-41db-8c77-ed53824f6bbd'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "\u2026 aber mehr, viel mehr habe ich vor zu erreichen;"}'::jsonb, NOW(), 131, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('621f5a76-b9a0-4994-9257-7ba952457dd5'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "FRANKENSTEIN, ich nenne meine Geschichte \"Frankenstein\"."}'::jsonb, NOW(), 132, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e2abb54c-49c8-4107-9273-b6580c931764'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Fehlt da nicht was?"}'::jsonb, NOW(), 133, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('e5782465-db1b-467c-a9c2-9993939bd42e'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Was denn, soll ich sie Viktor Frankenstein nennen?"}'::jsonb, NOW(), 134, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('bb8f64ce-1fbd-4800-a27b-414a5c93459f'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Nein, deine Geschichte ist mehr als nur seine Geschichte? Sind es nicht Zwei, die ineinander Leben? Frankenstein im Monster?"}'::jsonb, NOW(), 135, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('32ce5140-8103-4e7b-892c-11f26f9960b6'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Das Monster in Frankenstein?"}'::jsonb, NOW(), 136, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('10360e90-1bef-408c-bd07-fa37751d26f3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Ja, und - deshalb hat das Monster keinen Namen, es braucht ihn nicht."}'::jsonb, NOW(), 137, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('42b5d1b5-0736-43cf-a02c-b64593a49a16'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Wer gibt seinem Kind keinen Namen?"}'::jsonb, NOW(), 138, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('7181d9d7-208c-4d92-b609-3b7cf8ceb346'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Wer entsetzt ist, \u00fcber das, was er geschaffen hat."}'::jsonb, NOW(), 139, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('4b3af3ef-36ad-4828-bd4e-48cf8726d0b0'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Ich bin Vater und Mutter der Geschichte, es ist meine Sch\u00f6pfung."}'::jsonb, NOW(), 140, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('fde3055d-e96f-4433-8ea8-83bf4ba0d730'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Ich wei\u00df, dass ich das Ding, das mich umtreibt verleugne, indem ich es nicht benenne."}'::jsonb, NOW(), 141, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('ab07e233-263d-4015-bfc7-0546487a15dc'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Doch welchen Namen soll man einer neuen Sch\u00f6pfung geben?"}'::jsonb, NOW(), 142, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('1690ee85-f517-4265-9d92-1260a9481a3c'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Ich, Viktor Frankenstein, werde \u00fcber die vorgezeichneten Bahnen hinaus neue Wege einschlagen, unbekannte Kr\u00e4fte erforschen und der Welt die tiefsten Geheimnisse der Sch\u00f6pfung offenbaren."}'::jsonb, NOW(), 143, 7, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('129b9225-0d88-4434-96c0-8139764946a1'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Geschichte ist das, wozu man sie macht."}'::jsonb, NOW(), 144, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('c352300b-4d27-47fc-a0be-c116ddb9828d'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Wir sind die Geschichte, die wir machen."}'::jsonb, NOW(), 145, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('0d3cf5fb-6acc-4300-9900-920d9aa18e1a'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Warum hast du mich verlassen?"}'::jsonb, NOW(), 146, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('717a063d-3cac-4caa-8717-a78dd980cd66'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Mein Vater verstie\u00df mich, -als ich so zu leben und zu lieben begann, wie er und wie meine Mutter es in ihren B\u00fcchern propagiert hatten. Meine Mutter...was w\u00fcrde meine Mutter sagen, wenn ich sie von den Toten zur\u00fcckholen k\u00f6nnte? Das Herz einer Frau, was ist das? Der Geist einer Frau, was ist das? Hat man uns im innersten Kern anders gemacht? Oder beruht Andersartigkeit nur auf Sitte und Macht?"}'::jsonb, NOW(), 147, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('5b610321-9d19-4063-9839-b349ff4057d3'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "Ich, Offenbarer eines neuen Menschen. Sehen sie sich die G\u00f6tter an, die wir uns bereits ausgedacht haben, egal ob griechisch, r\u00f6misch, indisch oder \u00e4gyptisch, babylonisch oder aztekisch, aus Ragnar\u00f6k oder Wallhalla, Wesen der Unterwelt oder des sternbesetzten Himmels: sie sind verbesserte Menschen; - sie haben unsere Gel\u00fcste, Fehden und Begierden,"}'::jsonb, NOW(), 148, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('40972635-1110-4bad-a2aa-344a4ccae559'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "FELIX", "line": "Gef\u00fchle"}'::jsonb, NOW(), 149, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('b7ecd9e1-f92c-4ffd-8b98-5729a8ba6da4'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "ALEXANDER", "line": "(irritierter Blick zu Felix) aber sie sind schnell, stark, nicht von der Biologie eingeschr\u00e4nkt und normalerweise unsterblich. \"Aber Mr. Frankenstein, Gott macht uns, wie wir sind und wir sollten ihm nicht ins Handwerk pfuschen\""}'::jsonb, NOW(), 150, 8, NULL, NULL);
INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title)
VALUES ('cb2dde9e-a4df-4044-921b-2acc72ffd910'::uuid, '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid, 'dialogue', '{"type": "dialogue", "speaker": "MAREN", "line": "Wenn Gott nicht gewollt h\u00e4tte, dass wir ihr ins Handwerk pfuschen, h\u00e4tte sie uns nicht mit einem Verstand ausgestattet. (In unserer Szene mit female creature hei\u00dft es leicht paraphrasiert: Wenn Gott nicht gewollt h\u00e4tte, dass du ihr ins Handwerk pfuschst, h\u00e4tte sie dich nicht dazu erschaffen, es zu tun.) Ich widme meinem Vater meinen ersten Roman. Frankenstein. Der moderne Prometheus. Ich bin 19 Jahre alt. Ich stehe am Rand. Der Gesellschaft."}'::jsonb, NOW(), 151, 8, NULL, NULL);

COMMIT;

-- Verify the insertion
SELECT 'Script created with ID: ' || id || ', Total blocks: ' || 
       (SELECT COUNT(*) FROM blocks WHERE script_id = scripts.id) as result
FROM scripts 
WHERE id = '7b8cec29-5950-4e34-8966-cc36bae2f1dc'::uuid;
