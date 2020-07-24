// core-js and regenerator-runtime are required for babel polyfill.
import "core-js/stable";
import "regenerator-runtime/runtime";

import { Observable } from "rxjs";

import * as octant from "./octant/plugin";
import * as c from "./octant/components";

export function buildHelmRelease(
  namespace: string,
  repository: string,
  name: string,
  version: string
): string {
  return `---
    apiVersion: helm.fluxcd.io/v1
    kind: HelmRelease
    metadata:
      name: ${name}
      namespace: ${namespace}
    spec:
      chart:
        repository: ${repository}
        name: ${name}
        version: ${version}
    `;
}

export function searchTable(
  querySubject: Observable<string>,
  chartListSubject: Observable<any>
): octant.View {
  var qs: string;
  querySubject.subscribe((data) => {
    qs = data;
  });

  const tbl = new c.Table("", [
    { name: "ID", accessor: "ID" },
    { name: "Name", accessor: "Name" },
    { name: "Description", accessor: "Description" },
    { name: "Latest Version", accessor: "Latest Version" },
    { name: "Source", accessor: "Source" },
  ]);

  chartListSubject.subscribe((data) => {
    if (data !== undefined) {
      data.forEach((v: any, i: number) => {
        let row: { [key: string]: octant.View } = {};
        row["ID"] = c.createText(v.id);
        row["Name"] = c.createText(v.attributes.name);
        row["Description"] = c.createText(v.attributes.description);
        row["Latest Version"] = c.createText(
          v.relationships.latestChartVersion.data.version
        );
        row["Source"] = c.createLink(
          v.attributes.sources[0],
          v.attributes.sources[0]
        );

        let payload: { [key: string]: string } = {};
        payload["repository"] = v.attributes.repo.url as string;
        payload["name"] = v.attributes.name as string;
        payload["version"] = v.relationships.latestChartVersion.data
          .version as string;

        const body =
          "Are you sure you want to install " +
          v.attributes.name +
          " (version: " +
          v.relationships.latestChartVersion.data.version +
          ")";
        const gridActions = [
          c.createGridAction("Install", "helm-plugin/installChart", payload, {
            title: "Install Chart?",
            body: body,
          }),
        ];
        tbl.addRow(row, gridActions);
      });
    }
  });

  let summary = {
    metadata: { type: "summary" },
    title: [{ metadata: { type: "text" }, config: { value: "Query" } }],
    config: {
      actions: [
        {
          name: "Change query",
          title: "Change chart query",
          modal: false,
          form: {
            fields: [
              { label: "Query", name: "q", type: "text", value: qs },
              {
                name: "action",
                value: "helm-plugin/queryCharts",
                type: "hidden",
              },
            ],
          },
        },
      ],
      sections: [
        {
          header: "Query",
          content: { metadata: { type: "text" }, config: { value: qs } },
        },
      ],
    },
    width: c.Width.Half,
  };

  const layout = new c.FlexLayout("Search Charts");
  layout.addSection([{ view: summary, width: c.Width.Half }]);
  layout.addSection([{ view: tbl, width: c.Width.Full }]);

  return layout;
}

export function installedTable(dashboardClient: octant.DashboardClient, namespace: string): octant.View {
  let installed = new c.FlexLayout("Installed Charts");
  let releases = dashboardClient.List({
    namespace: namespace,
    apiVersion: "helm.fluxcd.io/v1",
    kind: "HelmRelease",
  });

  const relTbl = new c.Table("", [
    { name: "Name", accessor: "Name" },
    { name: "Version", accessor: "Version" },
    { name: "Repo", accessor: "Repo" },
    { name: "Namespace", accessor: "Namespace" },
    { name: "Status", accessor: "Status" },
  ]);

  if (releases !== undefined) {
    releases.forEach((v: any, i: number) => {
      let row: { [key: string]: octant.View } = {};
      row["Name"] = c.createLink(
        v.metadata.name,
        `/overview/namespace/${namespace}/custom-resources/helmreleases.helm.fluxcd.io/v1/${v.metadata.name}`
      );
      row["Version"] = c.createText(v.spec.chart.version);
      row["Repo"] = c.createLink(
        v.spec.chart.repository,
        v.spec.chart.repository
      );
      row["Namespace"] = c.createLink(
        v.metadata.namespace,
        `/overview/namespace/${v.metadata.namespace}`
      );
      var status: octant.View;
      status = (v.status !== undefined) ? c.createText(v.status.phase) : c.createText("Unknown");
      row["Status"] = status;

      let payload: { [key: string]: string } = {};
      payload["name"] = v.metadata.name as string;
      payload["namespace"] = namespace;

      const body =
        "Are you sure you want to delete " +
        v.metadata.name +
        " (version: " +
        v.spec.chart.version +
        ")";
      const gridActions = [
        c.createGridAction(
          "Delete",
          "helm-plugin/deleteChart",
          payload,
          { title: "Delete Chart?", body: body },
          "danger"
        ),
      ];
      relTbl.addRow(row, gridActions);
    });
  }

  installed.addSection([{ view: relTbl, width: c.Width.Full }]);
  return installed
}
