-- Seed: initial interview prompts, one per domain (version 1)
-- ord controls display order within a domain; add more prompts per domain later.

insert into public.interview_prompts (domain, text, version, ord) values
  -- childhood
  ('childhood', 'What is your earliest memory? Describe it as vividly as you can — where you were, who was there, what you felt.', 1, 10),
  ('childhood', 'What was your home like growing up? What did it smell like, sound like, feel like?', 1, 20),
  ('childhood', 'Who was the most important adult in your childhood, and what did they teach you — by example or by word?', 1, 30),
  ('childhood', 'What was hard about growing up in your family or community? How did it shape you?', 1, 40),

  -- family
  ('family', 'Tell me about your parents or the people who raised you — not their biography, but who they were as people.', 1, 10),
  ('family', 'Do you have siblings? What was your relationship like, and how has it changed over time?', 1, 20),
  ('family', 'What traditions — big or small — do you most want passed down? Where did they come from?', 1, 30),
  ('family', 'What do you wish you had said to a family member that you never got to say?', 1, 40),

  -- career
  ('career', 'What is the work you''ve done that you are most proud of — and why?', 1, 10),
  ('career', 'Describe a time you failed at something important in your working life. What did you learn?', 1, 20),
  ('career', 'If you could give one piece of advice to someone starting out in your field, what would it be?', 1, 30),
  ('career', 'What did work cost you — in time, relationships, or other ways — and was it worth it?', 1, 40),

  -- values
  ('values', 'What do you believe most deeply? Name one principle you have tried to live by, and give an example of when it was tested.', 1, 10),
  ('values', 'What have you changed your mind about as you have gotten older? What changed it?', 1, 20),
  ('values', 'Where do you find meaning? Not what you think you should find it in — where do you actually find it?', 1, 30),

  -- beliefs
  ('beliefs', 'What do you believe happens after we die? How does that belief affect how you live?', 1, 10),
  ('beliefs', 'What role has faith, spirituality, or philosophy played in your life?', 1, 20),
  ('beliefs', 'What is the most important lesson the world has taught you about how to treat other people?', 1, 30),

  -- lessons
  ('lessons', 'What is the single most important thing you have learned — the one you would most want your children or heirs to carry?', 1, 10),
  ('lessons', 'What mistake do you most hope others will avoid? What caused it and what did it cost?', 1, 20),
  ('lessons', 'What would you do differently if you could start over, knowing what you know now?', 1, 30),
  ('lessons', 'What are you still figuring out? What question are you still sitting with?', 1, 40),

  -- messages
  ('messages', 'If you could say one thing to the people who will miss you most, what would it be?', 1, 10),
  ('messages', 'Is there someone you need to forgive, or someone you hope will forgive you? What would you say to them?', 1, 20),
  ('messages', 'What do you hope people remember about you — not your accomplishments, but the feeling of knowing you?', 1, 30);
