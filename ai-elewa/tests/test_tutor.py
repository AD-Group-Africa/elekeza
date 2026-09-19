import pytest
from unittest.mock import AsyncMock, patch
from models.requests import LearnerContext, TutorChatMessage, TutorChatRequest
from models.responses import TutorChatResponse
from endpoints.tutor import tutor_chat, _build_system_prompt, _build_messages_payload



ALL_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]


def make_context(profiles: list[str], language_level: int = 1) -> LearnerContext:
    return LearnerContext(
        learner_id="test-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=1,
        pathway_stage="Foundation",
    )


def make_request(
    profiles: list[str] = None,
    messages: list[dict] = None,
    lesson_context: str = None,
    action: str = None,
) -> TutorChatRequest:
    if profiles is None:
        profiles = ["dyslexia"]
    if messages is None:
        messages = [{"role": "user", "content": "What is evaporation?"}]
    return TutorChatRequest(
        learner_context=make_context(profiles),
        messages=[TutorChatMessage(**m) for m in messages],
        lesson_context=lesson_context,
        current_action=action,
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def test_system_prompt_contains_profile():
    prompt = _build_system_prompt("dyslexia", 1, None)
    assert "dyslexia" in prompt


def test_system_prompt_contains_language_level():
    prompt = _build_system_prompt("adhd", 2, None)
    assert "2" in prompt


def test_system_prompt_contains_action_instruction_when_set():
    prompt = _build_system_prompt("autism", 1, "explain")
    assert "Explain" in prompt


def test_system_prompt_no_action_instruction_when_none():
    prompt = _build_system_prompt("autism", 1, None)
    assert "Your task:" not in prompt


def test_system_prompt_contains_kiswahili_for_translate_action():
    prompt = _build_system_prompt("dyslexia", 1, "translate")
    assert "Kiswahili" in prompt


def test_system_prompt_generated_for_all_profiles():
    for profile in ALL_PROFILES:
        prompt = _build_system_prompt(profile, 1, None)
        assert isinstance(prompt, str)
        assert len(prompt) > 0


def test_system_prompt_comorbid_profile():
    prompt = _build_system_prompt("dyslexia+intellectual_disability", 1, None)
    assert isinstance(prompt, str)
    assert len(prompt) > 0


# ---------------------------------------------------------------------------
# Message payload builder
# ---------------------------------------------------------------------------

def test_messages_payload_includes_user_message():
    request = make_request(messages=[{"role": "user", "content": "What is rain?"}])
    payload = _build_messages_payload(request)
    user_messages = [m for m in payload if m["role"] == "user"]
    assert any("What is rain?" in m["content"] for m in user_messages)


def test_messages_payload_prepends_lesson_context():
    request = make_request(
        messages=[{"role": "user", "content": "What is rain?"}],
        lesson_context="The water cycle explains how water moves.",
    )
    payload = _build_messages_payload(request)
    assert payload[0]["role"] == "user"
    assert "water cycle" in payload[0]["content"]


def test_messages_payload_without_lesson_context():
    request = make_request(messages=[{"role": "user", "content": "Hello"}])
    payload = _build_messages_payload(request)
    assert payload[0]["content"] == "Hello"


def test_messages_payload_preserves_conversation_history():
    request = make_request(messages=[
        {"role": "user", "content": "What is rain?"},
        {"role": "assistant", "content": "Rain is water falling from clouds."},
        {"role": "user", "content": "Why does it fall?"},
    ])
    payload = _build_messages_payload(request)
    assert len(payload) == 3


# ---------------------------------------------------------------------------
# tutor_chat endpoint
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tutor_chat_returns_reply():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Evaporation is when water turns into vapour."
        result = await tutor_chat(request)
    assert result.reply == "Evaporation is when water turns into vapour."


@pytest.mark.asyncio
async def test_tutor_chat_fallback_false_on_success():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water evaporates when heated."
        result = await tutor_chat(request)
    assert result.fallback is False


@pytest.mark.asyncio
async def test_tutor_chat_fallback_true_on_empty_reply():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = ""
        result = await tutor_chat(request)
    assert result.fallback is True


@pytest.mark.asyncio
async def test_tutor_chat_fallback_true_on_whitespace_reply():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "   \n  "
        result = await tutor_chat(request)
    assert result.fallback is True


@pytest.mark.asyncio
async def test_tutor_chat_action_handled_returned():
    request = make_request(action="explain")
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Evaporation is when water heats up and turns to gas."
        result = await tutor_chat(request)
    assert result.action_handled == "explain"


@pytest.mark.asyncio
async def test_tutor_chat_action_none_when_not_set():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water evaporates when heated."
        result = await tutor_chat(request)
    assert result.action_handled is None


@pytest.mark.asyncio
async def test_tutor_chat_uses_fast_model():
    request = make_request()
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water evaporates when heated."
        await tutor_chat(request)
    call_kwargs = mock.call_args.kwargs
    assert call_kwargs["model"] == config.STAGE3_MODEL


@pytest.mark.asyncio
async def test_tutor_chat_runs_for_all_profiles():
    for profile in ALL_PROFILES:
        request = make_request(profiles=[profile])
        with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
            mock.return_value = "Water evaporates when heated."
            result = await tutor_chat(request)
        assert isinstance(result.reply, str)
        assert len(result.reply) > 0


@pytest.mark.asyncio
async def test_tutor_chat_runs_for_comorbid_profile():
    request = make_request(profiles=["dyslexia", "intellectual_disability"])
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water evaporates when heated."
        result = await tutor_chat(request)
    assert result.fallback is False


@pytest.mark.asyncio
async def test_tutor_chat_runs_for_all_actions():
    actions = ["explain", "practice", "read_aloud", "translate", "diagram", "summarise"]
    for action in actions:
        request = make_request(action=action)
        with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
            mock.return_value = f"Response for {action}."
            result = await tutor_chat(request)
        assert result.action_handled == action


@pytest.mark.asyncio
async def test_tutor_chat_with_lesson_context():
    request = make_request(
        messages=[{"role": "user", "content": "Summarise this for me."}],
        lesson_context="The water cycle explains how water moves around Earth.",
        action="summarise",
    )
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water moves around Earth in a cycle."
        result = await tutor_chat(request)
    assert result.reply == "Water moves around Earth in a cycle."


@pytest.mark.asyncio
async def test_tutor_chat_with_conversation_history():
    request = make_request(messages=[
        {"role": "user", "content": "What is rain?"},
        {"role": "assistant", "content": "Rain is water from clouds."},
        {"role": "user", "content": "Why does it form clouds?"},
    ])
    with patch("endpoints.tutor.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Water vapour rises and cools to form clouds."
        result = await tutor_chat(request)
    assert result.fallback is False


# ---------------------------------------------------------------------------
# Request model validation
# ---------------------------------------------------------------------------

def test_tutor_request_requires_at_least_one_message():
    with pytest.raises(Exception):
        TutorChatRequest(
            learner_context=make_context(["dyslexia"]),
            messages=[],
        )


def test_tutor_request_valid_actions_accepted():
    valid_actions = ["explain", "practice", "read_aloud", "translate", "diagram", "summarise"]
    for action in valid_actions:
        req = make_request(action=action)
        assert req.current_action == action


def test_tutor_response_model_has_required_fields():
    response = TutorChatResponse(reply="Hello.")
    assert response.reply == "Hello."
    assert response.fallback is False
    assert response.action_handled is None


def test_tutor_response_fallback_can_be_set():
    response = TutorChatResponse(reply="Sorry.", fallback=True)
    assert response.fallback is True


import config