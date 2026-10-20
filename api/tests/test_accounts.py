"""Merchant accounts: invites, login, sessions, admin routes. Run from the repo root: python -m pytest api/tests"""
import os
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from api import accounts
from api.main import app

ADMIN = {"X-Admin-Key": "test-admin-key"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    # SQLite by default; set TEST_DATABASE_URL to run against Postgres (its tables are emptied first)
    url = os.environ.get("TEST_DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", url or f"sqlite:///{tmp_path / 'test.db'}")
    if url:
        accounts.reset_engine()
        accounts.metadata.drop_all(accounts.engine())

    monkeypatch.setenv("ADMIN_KEY", "test-admin-key")
    monkeypatch.delenv("APP_ACCESS_KEY", raising=False)
    accounts.reset_engine()
    accounts._failures.clear()
    yield TestClient(app)
    accounts.reset_engine()


def invite(client, email=None):
    m = client.post("/v1/admin/merchants", json={"name": "Corner Bakery"}, headers=ADMIN).json()
    return m, client.post("/v1/admin/invites", json={"merchant_id": m["id"], "email": email}, headers=ADMIN).json()


def test_invite_signup_login_me_logout(client):
    m, inv = invite(client)
    assert len(inv["code"]) == 11 and inv["code"][5] == "-"
    # Codes are forgiving about case and the dash
    r = client.post("/v1/auth/invite", json={"code": inv["code"].lower().replace("-", ""), "email": " Owner@Bakery.com ", "password": "long enough pw"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == "owner@bakery.com" and body["merchant"] == {"id": m["id"], "name": "Corner Bakery"}
    auth = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/v1/auth/me", headers=auth).json()["merchant"]["name"] == "Corner Bakery"

    # The code is single-use
    again = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "other@bakery.com", "password": "long enough pw"})
    assert again.status_code == 400

    login = client.post("/v1/auth/login", json={"email": "OWNER@bakery.com", "password": "long enough pw"})
    assert login.status_code == 200 and login.json()["token"] != body["token"]

    assert client.post("/v1/auth/logout", headers=auth).status_code == 200
    assert client.get("/v1/auth/me", headers=auth).status_code == 401
    # The other session still works
    assert client.get("/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"}).status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(client):
    _, inv = invite(client)
    client.post("/v1/auth/invite", json={"code": inv["code"], "email": "a@b.com", "password": "long enough pw"})
    wrong = client.post("/v1/auth/login", json={"email": "a@b.com", "password": "nope nope nope"})
    unknown = client.post("/v1/auth/login", json={"email": "x@y.com", "password": "nope nope nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_login_is_throttled(client):
    for _ in range(accounts.MAX_FAILURES):
        client.post("/v1/auth/login", json={"email": "a@b.com", "password": "wrong password"})
    assert client.post("/v1/auth/login", json={"email": "a@b.com", "password": "wrong password"}).status_code == 429


def test_invite_rules(client):
    _, inv = invite(client, email="named@shop.com")
    short = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "named@shop.com", "password": "short"})
    assert short.status_code == 422
    other = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "someone@else.com", "password": "long enough pw"})
    assert other.status_code == 400 and "different email" in other.json()["detail"]
    # Expired
    _, inv2 = invite(client)
    with accounts.engine().begin() as conn:
        conn.execute(update(accounts.invites).values(expires_at=accounts.now() - timedelta(days=1)))
    expired = client.post("/v1/auth/invite", json={"code": inv2["code"], "email": "z@z.com", "password": "long enough pw"})
    assert expired.status_code == 400


def test_expired_session_is_rejected(client):
    _, inv = invite(client)
    token = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "a@b.com", "password": "long enough pw"}).json()["token"]
    with accounts.engine().begin() as conn:
        conn.execute(update(accounts.sessions).values(expires_at=accounts.now() - timedelta(seconds=1)))
    assert client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_delete_account_needs_password(client):
    _, inv = invite(client)
    token = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "a@b.com", "password": "long enough pw"}).json()["token"]
    auth = {"Authorization": f"Bearer {token}"}
    assert client.post("/v1/auth/delete-account", json={"password": "wrong"}, headers=auth).status_code == 401
    assert client.post("/v1/auth/delete-account", json={"password": "long enough pw"}, headers=auth).status_code == 200
    assert client.get("/v1/auth/me", headers=auth).status_code == 401
    assert client.post("/v1/auth/login", json={"email": "a@b.com", "password": "long enough pw"}).status_code == 401


def test_admin_routes_need_the_key(client, monkeypatch):
    assert client.post("/v1/admin/merchants", json={"name": "X"}).status_code == 401
    assert client.post("/v1/admin/merchants", json={"name": "X"}, headers={"X-Admin-Key": "wrong"}).status_code == 401
    invite(client)
    assert client.get("/v1/admin/merchants", headers=ADMIN).json() == [{"id": 1, "name": "Corner Bakery", "users": 0}]
    monkeypatch.delenv("ADMIN_KEY")
    assert client.get("/v1/admin/merchants", headers=ADMIN).status_code == 403


def test_statement_routes_need_login(client):
    assert client.post("/v1/report", json={"lines": []}).status_code == 401
    _, inv = invite(client)
    token = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "a@b.com", "password": "long enough pw"}).json()["token"]
    r = client.post("/v1/invoice/check", json={"lines": []}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and "checks" in r.json()


def test_password_hashes_are_salted():
    a, b = accounts.hash_password("same password"), accounts.hash_password("same password")
    assert a != b and accounts.verify_password("same password", a) and not accounts.verify_password("other", a)


def test_admin_can_remove_a_login_for_a_password_reset(client):
    m, inv = invite(client)
    token = client.post("/v1/auth/invite", json={"code": inv["code"], "email": "a@b.com", "password": "long enough pw"}).json()["token"]
    assert client.post("/v1/admin/remove-user", json={"email": "A@B.com"}, headers=ADMIN).status_code == 200
    assert client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    # A fresh invite lets them back in with a new password
    code = client.post("/v1/admin/invites", json={"merchant_id": m["id"], "email": "a@b.com"}, headers=ADMIN).json()["code"]
    assert client.post("/v1/auth/invite", json={"code": code, "email": "a@b.com", "password": "a new password"}).status_code == 200
    assert client.post("/v1/admin/remove-user", json={"email": "nobody@x.com"}, headers=ADMIN).status_code == 404
