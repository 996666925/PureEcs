window.BENCHMARK_DATA = {
  "lastUpdate": 1788874071840,
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
          "id": "2de4e92bd9198aca56fbbadfa5d39e874ec91f1c",
          "message": "perf: 新增零物化查询 API",
          "timestamp": "2026-09-08T13:35:56+08:00",
          "tree_id": "643cc705d567f01f7502617f4ace313d8f22ff3a",
          "url": "https://github.com/996666925/PureEcs/commit/2de4e92bd9198aca56fbbadfa5d39e874ec91f1c"
        },
        "date": 1788845787944,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 47.718644,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 48.06337400000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 30.33309399999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 27.978441000000004,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 32.549623000000025,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 50.101399000000015,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 64.67889199999996,
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
          "id": "7ea7c7a0d7be28b3e90eb04297fe7f93b7d1ff29",
          "message": "perf：提升实体销毁效率",
          "timestamp": "2026-09-08T17:54:38+08:00",
          "tree_id": "4a4db5367d89ec093431f2bf30ffbca5f7f11083",
          "url": "https://github.com/996666925/PureEcs/commit/7ea7c7a0d7be28b3e90eb04297fe7f93b7d1ff29"
        },
        "date": 1788861304078,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 51.18775099999999,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 29.82367500000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 20.12336400000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 15.703487999999993,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 17.005705999999975,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 30.44387499999999,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 14.165689999999984,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "committer": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "distinct": true,
          "id": "5ec7cff61c82e3a3d2001e6de8c26fba1697349d",
          "message": "perf: 优化查询热路径",
          "timestamp": "2026-09-08T20:03:39+08:00",
          "tree_id": "a888e0e1e2e13d2c04c51d3a2a7fa5e77a7d915b",
          "url": "https://github.com/996666925/PureEcs/commit/5ec7cff61c82e3a3d2001e6de8c26fba1697349d"
        },
        "date": 1788869048547,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 50.051996,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 29.39329500000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 16.07936699999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 13.41374300000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 10.235337000000015,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 25.68375499999999,
            "unit": "ms"
          },
          {
            "name": "params Query system (materialized)",
            "value": 27.061217000000028,
            "unit": "ms"
          },
          {
            "name": "params Query systemForEach",
            "value": 15.225062000000008,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 14.672684000000004,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "committer": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "distinct": true,
          "id": "d9fadf4d588bad9681cd4a4542077c9b1faa2c62",
          "message": "perf: 为 1-3 组件查询添加免分配快速路径",
          "timestamp": "2026-09-08T21:13:43+08:00",
          "tree_id": "287b3dfd61fef737f60ac63a7a309d5c61f8d979",
          "url": "https://github.com/996666925/PureEcs/commit/d9fadf4d588bad9681cd4a4542077c9b1faa2c62"
        },
        "date": 1788873254652,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 54.337885000000014,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 30.81386599999999,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 18.17829500000002,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 14.995642999999973,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 12.240740999999986,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 29.644717999999983,
            "unit": "ms"
          },
          {
            "name": "params Query system (materialized)",
            "value": 31.46029299999998,
            "unit": "ms"
          },
          {
            "name": "params Query systemForEach",
            "value": 12.799707000000012,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 16.675684999999987,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "committer": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "distinct": true,
          "id": "50a9b4ea3292013bacc9f33c7701c2d83f9b2d78",
          "message": "perf(world): SparseSet.insert 直接返回是否为新实体",
          "timestamp": "2026-09-08T21:21:12+08:00",
          "tree_id": "343b045589c0b855913c9b1afac5f6782b1723d9",
          "url": "https://github.com/996666925/PureEcs/commit/50a9b4ea3292013bacc9f33c7701c2d83f9b2d78"
        },
        "date": 1788873702164,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 49.197924,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 30.91813399999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 17.91843700000001,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 13.99231899999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 11.078543999999994,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 30.81653399999999,
            "unit": "ms"
          },
          {
            "name": "params Query system (materialized)",
            "value": 33.877392000000015,
            "unit": "ms"
          },
          {
            "name": "params Query systemForEach",
            "value": 12.270357000000047,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 14.51428900000002,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "committer": {
            "email": "996666925@qq.com",
            "name": "996666925",
            "username": "996666925"
          },
          "distinct": true,
          "id": "cf44045e3365d5a7ee601fe36b250d80b51f05e5",
          "message": "release: 发布 v0.0.2",
          "timestamp": "2026-09-08T21:27:23+08:00",
          "tree_id": "8f74a2e41d404ee06ec5ba0a5dd6fa866471c09d",
          "url": "https://github.com/996666925/PureEcs/commit/cf44045e3365d5a7ee601fe36b250d80b51f05e5"
        },
        "date": 1788874071049,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "spawn + insert Position/Velocity",
            "value": 56.484352000000015,
            "unit": "ms"
          },
          {
            "name": "getComponent lookup",
            "value": 33.68807199999998,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position",
            "value": 19.696994999999987,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach Position + Velocity",
            "value": 16.045116000000007,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.forEach with With(Active)",
            "value": 12.154717000000005,
            "unit": "ms"
          },
          {
            "name": "QueryEngine.iter Position + Velocity",
            "value": 30.640394000000015,
            "unit": "ms"
          },
          {
            "name": "params Query system (materialized)",
            "value": 31.951512000000037,
            "unit": "ms"
          },
          {
            "name": "params Query systemForEach",
            "value": 13.217850000000055,
            "unit": "ms"
          },
          {
            "name": "despawn entities",
            "value": 16.874457000000007,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}