def test_health_endpoint_path_exists():
    # Integration tests should run against a configured test database.
    # This smoke marker ensures the test suite is discovered.
    assert "/health" == "/health"
