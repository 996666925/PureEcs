window.BENCHMARK_DATA = {
  "lastUpdate": 1788842067732,
  "repoUrl": "https://github.com/996666925/PureEcs",
  "entries": {
    "Benchmark": [
      {
        "commit": {
          "author": {
            "email": "1152207863@qq.com",
            "name": "115220783",
            "username": "996666925"
          },
          "committer": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "韩伟朝"
          },
          "distinct": true,
          "id": "b09cbaa719b7631fec5bd2de7f44f8fec6382c5a",
          "message": "ci: 新增性能基准测试与提交性能对比",
          "timestamp": "2026-09-08T12:27:10+08:00",
          "tree_id": "964470060c629b11a519da54634e8859c32769f4",
          "url": "https://github.com/996666925/PureEcs/commit/b09cbaa719b7631fec5bd2de7f44f8fec6382c5a"
        },
        "date": 1788842067080,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 50.572226,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 60.99108699999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 60.27637999999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 49.235888999999986,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 56.923531000000025,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 67.53699,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 64.89903700000002,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}