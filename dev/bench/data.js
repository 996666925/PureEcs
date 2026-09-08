window.BENCHMARK_DATA = {
  "lastUpdate": 1788844491354,
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
      },
      {
        "commit": {
          "author": {
            "email": "996666925@qq.com",
            "name": "115220783",
            "username": "996666925"
          },
          "committer": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "韩伟朝"
          },
          "distinct": true,
          "id": "7e3e7b6cf8ceb80174e0582bdfc4cbf14464c33c",
          "message": "ci: 新增性能基准测试与提交性能对比",
          "timestamp": "2026-09-08T12:42:01+08:00",
          "tree_id": "964470060c629b11a519da54634e8859c32769f4",
          "url": "https://github.com/996666925/PureEcs/commit/7e3e7b6cf8ceb80174e0582bdfc4cbf14464c33c"
        },
        "date": 1788842564198,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 51.98231,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 60.83647499999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 57.29904499999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 47.37311100000005,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 59.21983499999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 71.94035200000002,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 69.73838700000005,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "committer": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "distinct": true,
          "id": "556f4f1700a065fe1ece51e149c0e9197d49c3e3",
          "message": "perf(world): 用按组件 ID 直接索引的数组替换 Map 存储",
          "timestamp": "2026-09-08T12:49:23+08:00",
          "tree_id": "bc099ae89985504b560dc479024c0f6934ec3048",
          "url": "https://github.com/996666925/PureEcs/commit/556f4f1700a065fe1ece51e149c0e9197d49c3e3"
        },
        "date": 1788842991453,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 48.056906,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 47.71647499999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 56.43072799999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 44.84252600000002,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 55.830805999999995,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 65.75663100000003,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 63.12759,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "committer": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "distinct": true,
          "id": "13976bb5d7f95011c7b373e47fb98ab9ae2d66f4",
          "message": "perf: 缓存 Single 查询引擎",
          "timestamp": "2026-09-08T12:59:45+08:00",
          "tree_id": "af583bebfe87f9e36f02b9d101dd65c6ea129d92",
          "url": "https://github.com/996666925/PureEcs/commit/13976bb5d7f95011c7b373e47fb98ab9ae2d66f4"
        },
        "date": 1788843683673,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 51.18746599999999,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 52.55705499999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 60.83046300000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 50.70504799999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 59.28341999999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 74.541899,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 84.989059,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "committer": {
            "email": "hanweizhao@qcwlcloud.com",
            "name": "996666925"
          },
          "distinct": true,
          "id": "caa0c3fee6563fc20607691087ab88132c6d74de",
          "message": "perf: 减少 SparseSet 遍历开销",
          "timestamp": "2026-09-08T13:14:18+08:00",
          "tree_id": "6e7238e2d6ae23be483a1fddbcade33befa44b93",
          "url": "https://github.com/996666925/PureEcs/commit/caa0c3fee6563fc20607691087ab88132c6d74de"
        },
        "date": 1788844490351,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 54.30472400000001,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 49.140068000000014,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 36.08272199999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 34.833406999999994,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 42.60754700000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 53.62903399999999,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 77.44888100000003,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}