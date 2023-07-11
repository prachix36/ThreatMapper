import { useSuspenseQuery } from '@suspensive/react-query';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Combobox,
  ComboboxOption,
  createColumnHelper,
  SortingState,
  Table,
  TableSkeleton,
} from 'ui-components';

import { ModelPod } from '@/api/generated';
import { DFLink } from '@/components/DFLink';
import { FilterBadge } from '@/components/filters/FilterBadge';
import { SearchableClusterList } from '@/components/forms/SearchableClusterList';
import { SearchableHostList } from '@/components/forms/SearchableHostList';
import { FilterIcon } from '@/components/icons/common/Filter';
import { TimesIcon } from '@/components/icons/common/Times';
import { TruncatedText } from '@/components/TruncatedText';
import { NodeDetailsStackedModal } from '@/features/topology/components/NodeDetailsStackedModal';
import { queries } from '@/queries';
import { ScanTypeEnum } from '@/types/common';
import {
  getOrderFromSearchParams,
  getPageFromSearchParams,
  useSortingState,
} from '@/utils/table';

const DEFAULT_PAGE_SIZE = 25;

export const PodsTable = () => {
  const [searchParams] = useSearchParams();
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  return (
    <div className="px-4 pb-4">
      <div className="h-12 flex items-center">
        <Button
          variant="flat"
          className="ml-auto"
          startIcon={<FilterIcon />}
          endIcon={
            getAppliedFiltersCount(searchParams) > 0 ? (
              <Badge
                label={String(getAppliedFiltersCount(searchParams))}
                variant="filled"
                size="small"
                color="blue"
              />
            ) : null
          }
          size="sm"
          onClick={() => {
            setFiltersExpanded((prev) => !prev);
          }}
        >
          Filter
        </Button>
      </div>

      {filtersExpanded ? <Filters /> : null}
      <Suspense
        fallback={<TableSkeleton rows={DEFAULT_PAGE_SIZE} columns={4} size="default" />}
      >
        <DataTable />
      </Suspense>
    </div>
  );
};

const FILTER_SEARCHPARAMS: Record<string, string> = {
  hosts: 'Host',
  clusters: 'Cluster',
  kubernetesStatus: 'Kubernetes status',
};

const getAppliedFiltersCount = (searchParams: URLSearchParams) => {
  return Object.keys(FILTER_SEARCHPARAMS).reduce((prev, curr) => {
    return prev + searchParams.getAll(curr).length;
  }, 0);
};
const KUBERNETES_STATUSES = [
  {
    label: 'Running',
    value: 'Running',
  },
  {
    label: 'Not Running',
    value: 'Not Running',
  },
];
function Filters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [kubernetesStatusSearchText, setKubernetesStatusSearchText] = useState('');
  const appliedFilterCount = getAppliedFiltersCount(searchParams);

  return (
    <div className="px-4 py-2.5 mb-4 border dark:border-bg-hover-3 rounded-[5px] overflow-hidden dark:bg-bg-left-nav">
      <div className="flex gap-2">
        <Combobox
          value={KUBERNETES_STATUSES.find((status) => {
            return status.value === searchParams.get('kubernetesStatus');
          })}
          nullable
          onQueryChange={(query) => {
            setKubernetesStatusSearchText(query);
          }}
          onChange={(value) => {
            setSearchParams((prev) => {
              if (value) {
                prev.set('kubernetesStatus', value.value);
              } else {
                prev.delete('kubernetesStatus');
              }
              prev.delete('page');
              return prev;
            });
          }}
          getDisplayValue={() => FILTER_SEARCHPARAMS['kubernetesStatus']}
        >
          {KUBERNETES_STATUSES.filter((item) => {
            if (!kubernetesStatusSearchText.length) return true;
            return item.label
              .toLowerCase()
              .includes(kubernetesStatusSearchText.toLowerCase());
          }).map((item) => {
            return (
              <ComboboxOption key={item.value} value={item}>
                {item.label}
              </ComboboxOption>
            );
          })}
        </Combobox>
        <SearchableHostList
          valueKey="hostName"
          scanType={ScanTypeEnum.VulnerabilityScan}
          defaultSelectedHosts={searchParams.getAll('hosts')}
          onClearAll={() => {
            setSearchParams((prev) => {
              prev.delete('hosts');
              prev.delete('page');
              return prev;
            });
          }}
          onChange={(value) => {
            setSearchParams((prev) => {
              prev.delete('hosts');
              value.forEach((host) => {
                prev.append('hosts', host);
              });
              prev.delete('page');
              return prev;
            });
          }}
        />
        <SearchableClusterList
          valueKey="nodeName"
          defaultSelectedClusters={searchParams.getAll('clusters')}
          onClearAll={() => {
            setSearchParams((prev) => {
              prev.delete('clusters');
              prev.delete('page');
              return prev;
            });
          }}
          onChange={(value) => {
            setSearchParams((prev) => {
              prev.delete('clusters');
              value.forEach((cluster) => {
                prev.append('clusters', cluster);
              });
              prev.delete('page');
              return prev;
            });
          }}
        />
      </div>
      {appliedFilterCount > 0 ? (
        <div className="flex gap-2.5 mt-4 flex-wrap items-center">
          {Array.from(searchParams)
            .filter(([key]) => {
              return Object.keys(FILTER_SEARCHPARAMS).includes(key);
            })
            .map(([key, value]) => {
              return (
                <FilterBadge
                  key={`${key}-${value}`}
                  onRemove={() => {
                    setSearchParams((prev) => {
                      const existingValues = prev.getAll(key);
                      prev.delete(key);
                      existingValues.forEach((existingValue) => {
                        if (existingValue !== value) prev.append(key, existingValue);
                      });
                      prev.delete('page');
                      return prev;
                    });
                  }}
                  text={`${FILTER_SEARCHPARAMS[key]}: ${value}`}
                />
              );
            })}
          <Button
            variant="flat"
            color="default"
            startIcon={<TimesIcon />}
            onClick={() => {
              setSearchParams((prev) => {
                Object.keys(FILTER_SEARCHPARAMS).forEach((key) => {
                  prev.delete(key);
                });
                prev.delete('page');
                return prev;
              });
            }}
            size="sm"
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function useSearchPodsWithPagination() {
  const [searchParams] = useSearchParams();
  return useSuspenseQuery({
    ...queries.search.podsWithPagination({
      page: getPageFromSearchParams(searchParams),
      pageSize: parseInt(searchParams.get('size') ?? String(DEFAULT_PAGE_SIZE)),
      order: getOrderFromSearchParams(searchParams),
      hosts: searchParams.getAll('hosts'),
      clusters: searchParams.getAll('clusters'),
      kubernetesStatus: searchParams.get('kubernetesStatus') ?? undefined,
    }),
    keepPreviousData: true,
  });
}

const DataTable = () => {
  const { data } = useSearchPodsWithPagination();
  const columnHelper = createColumnHelper<ModelPod>();
  const [clickedItem, setClickedItem] = useState<{
    nodeId: string;
    nodeType: string;
  }>();
  const [sort, setSort] = useSortingState();
  const [searchParams, setSearchParams] = useSearchParams();

  const columns = useMemo(
    () => [
      columnHelper.accessor('pod_name', {
        cell: (info) => {
          return (
            <div className="flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="truncate"
              >
                <DFLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setClickedItem({
                      nodeId: info.row.original.node_id!,
                      nodeType: 'pod',
                    });
                  }}
                >
                  <TruncatedText text={info.getValue() || '-'} />
                </DFLink>
              </button>
            </div>
          );
        },
        header: () => <TruncatedText text="Pod Name" />,
        minSize: 130,
        size: 140,
        maxSize: 145,
      }),
      columnHelper.accessor('kubernetes_cluster_name', {
        cell: (info) => {
          return <TruncatedText text={info.getValue()} />;
        },
        header: () => <TruncatedText text="Cluster Name" />,
        minSize: 80,
        size: 80,
        maxSize: 90,
      }),
      columnHelper.accessor('kubernetes_namespace', {
        cell: (info) => {
          return <TruncatedText text={info.getValue()} />;
        },
        header: () => <TruncatedText text="Kubernetes Namespace" />,
        minSize: 100,
        size: 105,
        maxSize: 110,
      }),
      columnHelper.accessor('kubernetes_state', {
        cell: (info) => {
          return <TruncatedText text={info.getValue()} />;
        },
        header: () => <TruncatedText text="Kubernetes State" />,
        minSize: 80,
        size: 80,
        maxSize: 90,
      }),
    ],
    [],
  );

  return (
    <>
      <Table
        data={data.pods ?? []}
        columns={columns}
        noDataText="No hosts are connected"
        size="default"
        enableColumnResizing
        enablePagination
        manualPagination
        approximatePagination
        getRowId={(row) => row.node_id}
        totalRows={data.totalRows}
        pageIndex={data.currentPage}
        onPaginationChange={(updaterOrValue) => {
          let newPageIndex = 0;
          if (typeof updaterOrValue === 'function') {
            newPageIndex = updaterOrValue({
              pageIndex: data.currentPage,
              pageSize: parseInt(searchParams.get('size') ?? String(DEFAULT_PAGE_SIZE)),
            }).pageIndex;
          } else {
            newPageIndex = updaterOrValue.pageIndex;
          }
          setSearchParams((prev) => {
            prev.set('page', String(newPageIndex));
            return prev;
          });
        }}
        enableSorting
        manualSorting
        sortingState={sort}
        onSortingChange={(updaterOrValue) => {
          let newSortState: SortingState = [];
          if (typeof updaterOrValue === 'function') {
            newSortState = updaterOrValue(sort);
          } else {
            newSortState = updaterOrValue;
          }
          setSearchParams((prev) => {
            if (!newSortState.length) {
              prev.delete('sortby');
              prev.delete('desc');
            } else {
              prev.set('sortby', String(newSortState[0].id));
              prev.set('desc', String(newSortState[0].desc));
            }
            return prev;
          });
          setSort(newSortState);
        }}
        pageSize={parseInt(searchParams.get('size') ?? String(DEFAULT_PAGE_SIZE))}
        enablePageResize
        onPageResize={(newSize) => {
          setSearchParams((prev) => {
            prev.set('size', String(newSize));
            prev.delete('page');
            return prev;
          });
        }}
      />
      {clickedItem ? (
        <NodeDetailsStackedModal
          node={clickedItem}
          open={true}
          onOpenChange={(open) => {
            if (!open) setClickedItem(undefined);
          }}
        />
      ) : null}
    </>
  );
};
